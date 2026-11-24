import io
import json
import lzma
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import parse_legacy_backup as p


def fixture(inserts=None):
    inserts = inserts or {}
    parts = ["-- MySQL dump fixture", "-- Host: localhost    Database: bridge_analytics_prod"]
    for table in p.SCHEMA:
        parts.append(p.expected_create(table) + ";")
        if table in inserts:
            parts.append(f"INSERT INTO `{table}` VALUES {inserts[table]};")
    parts.append("-- Dump completed on 2026-10-18  5:30:01\n")
    return "\n".join(parts)


def valid_data():
    return {"company": "(1,'Example',3,NULL,'2025-07-01')", "sale_daily": "(1,1,'2026-01-01',123.4500,1e2,-2.50,-0.0)", "sale_monthly": "(1,1,1,2026,10,20,30,40)", "target_daily": "(1,1,'2026-01-01',100.123456789012345678901234567890)", "target_monthly": "(1,1,1,2026,150)", "target_yearly": "(1,1,'2025-2026',1000)", "user": "(1,'private-user','private-password','[\"ROLE_ADMIN\"]',1)", "user_key": "(1,1,'private-key-name','private-hash')"}


def parse(sql):
    return p.parse_dump(sql, "source.sql", "a" * 64)


class ParserTests(unittest.TestCase):
    def test_exact_decimals_and_fiscal_labels(self):
        result = parse(fixture(valid_data()))
        row = result["tables"]["sale_daily"][0]
        self.assertEqual([row[x] for x in ("amount", "due", "od", "cod_od")], ["123.45", "100", "-2.5", "0"])
        self.assertEqual(result["tables"]["target_daily"][0]["amount"], "100.12345678901234567890123456789")
        self.assertEqual(result["tables"]["target_yearly"][0]["year"], "2025-2026")
        self.assertEqual(result["snapshotAt"], "2026-10-18 05:30:01")

    def test_authentication_always_excluded(self):
        result = parse(fixture(valid_data()))
        encoded = json.dumps(result)
        for value in ("private-user", "private-password", "private-key-name", "private-hash", "ROLE_ADMIN"):
            self.assertNotIn(value, encoded)
        self.assertEqual(result["sourceCounts"]["user"], 1)
        self.assertEqual(result["sourceCounts"]["user_key"], 1)
        self.assertEqual(set(result["tables"]), set(p.BUSINESS_TABLES))

    def test_escaped_quotes_delimiters_and_comments_inside_strings(self):
        data = valid_data()
        data["company"] = r"(1,'Anondo\'s; -- /* */ comma, parentheses() \\ and ''quote''\nবাংলা',NULL,NULL,NULL)"
        result = parse(fixture(data))
        self.assertEqual(result["tables"]["company"][0]["name"], "Anondo's; -- /* */ comma, parentheses() \\ and 'quote'\nবাংলা")

    def test_json_mysql_escapes(self):
        data = valid_data()
        data["user"] = r'''(1,'private','secret','["role\\path","say \\"hello\\""]',1)'''
        # Generate the precise MySQL encoding of a JSON string with escaped quotes.
        roles_json = json.dumps(["role\\path", 'say "hello"'])
        sql_literal = "'" + roles_json.replace("\\", "\\\\").replace("'", "\\'") + "'"
        data["user"] = "(1,'private','secret'," + sql_literal + ",1)"
        self.assertEqual(parse(fixture(data))["sourceCounts"]["user"], 1)

    def test_explicit_columns_allowed_in_exact_order(self):
        sql = fixture(valid_data()).replace("INSERT INTO `company` VALUES", "INSERT INTO `company` (`id`,`name`,`biznet_id`,`legacy_id`,`biznet_start`) VALUES")
        self.assertEqual(parse(sql)["sourceCounts"]["company"], 1)

    def test_nullable_references_preserved(self):
        data = valid_data()
        data["sale_daily"] = data["sale_daily"].replace("(1,1,", "(1,NULL,")
        self.assertIsNone(parse(fixture(data))["tables"]["sale_daily"][0]["company_id"])

    def test_changed_autoincrement_counter_allowed(self):
        sql = fixture(valid_data()).replace(") ENGINE=InnoDB", ") ENGINE=InnoDB AUTO_INCREMENT=12345")
        self.assertEqual(parse(sql)["sourceCounts"]["company"], 1)

    def test_versioned_administrative_comments(self):
        sql = "/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;\n" + fixture(valid_data())
        self.assertEqual(parse(sql)["formatVersion"], 1)

    def test_schema_drift_rejected(self):
        original = fixture(valid_data())
        for before, after in [("`amount` double", "`amount` decimal(20,2)"), ("`name` varchar(255)", "`name` varchar(256)"), ("PRIMARY KEY (`id`)", "PRIMARY KEY (`name`)"), ("REFERENCES `company` (`id`)", "REFERENCES `user` (`id`)"), ("ENGINE=InnoDB", "ENGINE=MyISAM"), ("`biznet_id` smallint DEFAULT NULL", "`new_column` smallint DEFAULT NULL")]:
            with self.subTest(change=before), self.assertRaises(p.ValidationError):
                parse(original.replace(before, after, 1))

    def test_unknown_missing_or_repeated_table_rejected(self):
        sql = fixture(valid_data())
        variants = [sql.replace("`company`", "`mystery`"), sql.replace(p.expected_create("pnl") + ";", ""), sql + p.expected_create("company") + ";"]
        for variant in variants:
            with self.assertRaises(p.ValidationError):
                parse(variant)

    def test_nonempty_unmapped_tables_rejected(self):
        for table, value in [("eit_system", "(1,1,'key','{}')"), ("pnl", "(1,1,'{}',1,2026)")]:
            data = valid_data()
            data[table] = value
            with self.assertRaisesRegex(p.ValidationError, "requires a new migration mapping"):
                parse(fixture(data))

    def test_malicious_expressions_and_statements_rejected(self):
        for value in ("SLEEP(1)", "1+2", "0x10", "NaN", "Infinity", "'100'", "1e999999999", "NULL"):
            data = valid_data()
            data["target_daily"] = "(1,1,'2026-01-01'," + value + ")"
            with self.subTest(value=value), self.assertRaises(p.ValidationError):
                parse(fixture(data))
        for statement in ("SELECT 1;", "DELETE FROM `company`;", "/*!50000 DELETE FROM `company` */;", "SET SQL_MODE='NO_BACKSLASH_ESCAPES';", "DROP TABLE IF EXISTS `company`;", "CREATE TRIGGER `x`;"):
            with self.subTest(statement=statement), self.assertRaises(p.ValidationError):
                parse(fixture(valid_data()) + statement)

    def test_duplicate_ids_and_periods_rejected(self):
        for row in ("(1,1,'2026-01-02',1)", "(2,1,'2026-01-01',1)"):
            data = valid_data()
            data["target_daily"] += "," + row
            with self.assertRaises(p.ValidationError):
                parse(fixture(data))

    def test_invalid_dates_periods_and_references_rejected(self):
        data = valid_data()
        cases = [("target_daily", "2026-01-01", "2026-02-30"), ("target_daily", "(1,1,", "(1,999,"), ("target_daily", "(1,1,", "(0,1,"), ("target_monthly", "1,2026", "13,2026"), ("target_monthly", "1,2026", "1,26"), ("target_yearly", "2025-2026", "2025-2027"), ("user_key", "(1,1,", "(1,999,")]
        for table, before, after in cases:
            changed = dict(data)
            changed[table] = changed[table].replace(before, after)
            with self.subTest(table=table, after=after), self.assertRaises(p.ValidationError):
                parse(fixture(changed))

    def test_header_and_footer_validated_outside_strings(self):
        sql = fixture(valid_data())
        for variant in [sql.replace("Database: bridge_analytics_prod", "Database: other"), sql.replace("-- Dump completed on", "-- Incomplete dump on"), sql + "-- Dump completed on 2026-10-19 5:30:01\n", sql.replace("2026-10-18  5:30:01", "2026-10-40  5:30:01")]:
            with self.assertRaises(p.ValidationError):
                parse(variant)

    def test_malformed_or_truncated_rows_and_sql_rejected(self):
        data = valid_data()
        for row in ["(1,1,'2026-01-01',1),", "(1,1,'2026-01-01')", "(1,1,'2026-01-01',1,2)", "(1,1,'unterminated,1)"]:
            data["target_daily"] = row
            with self.assertRaises(p.ValidationError):
                parse(fixture(data))
        with self.assertRaises(p.ValidationError):
            parse(fixture(valid_data()) + "SET NAMES utf8mb4")

    def test_error_does_not_echo_auth_secret(self):
        data = valid_data()
        data["user"] = "(1,'private-user','private-password','not-json-private-secret',1)"
        with self.assertRaises(p.ValidationError) as caught:
            parse(fixture(data))
        self.assertNotIn("private", str(caught.exception))


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="parser-test-", dir=Path(__file__).resolve().parent)
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.assertEqual(self.root.resolve().parent, Path(__file__).resolve().parent)
        self.temp.cleanup()

    def make_archive(self, name="mysql_dump.sql", kind=None, extra=False, contents=None):
        raw = contents if contents is not None else fixture(valid_data()).encode()
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w") as handle:
            member = tarfile.TarInfo(name)
            member.size = len(raw)
            if kind is not None:
                member.type = kind
                member.linkname = "/outside.sql"
                member.size = 0
            handle.addfile(member, io.BytesIO(raw))
            if extra:
                handle.addfile(tarfile.TarInfo("second.sql"), io.BytesIO(b""))
        archive = self.root / "backup.sql.tar.xz"
        archive.write_bytes(lzma.compress(stream.getvalue()))
        return archive

    def test_archive_and_plain_sql_same_hash(self):
        archive = self.make_archive()
        sql_file = self.root / "source.sql"
        sql_file.write_bytes(fixture(valid_data()).encode())
        archived = p.parse_source(archive)
        plain = p.parse_source(sql_file)
        self.assertEqual(archived["sqlSha256"], plain["sqlSha256"])
        self.assertEqual(len(archived["archiveSha256"]), 64)
        self.assertIsNone(plain["archiveSha256"])
        self.assertEqual(archived["sourceFile"], archive.name)
        self.assertEqual(list(self.root.iterdir()), [archive, sql_file])

    def test_unsafe_members_rejected(self):
        for name, kind in [("../escape.sql", None), ("/absolute.sql", None), ("folder/dump.sql", None), ("C:\\file.sql", None), ("link.sql", tarfile.SYMTYPE), ("link.sql", tarfile.LNKTYPE), ("fifo.sql", tarfile.FIFOTYPE)]:
            with self.subTest(name=name, kind=kind), self.assertRaises(p.ValidationError):
                p.parse_source(self.make_archive(name, kind))

    def test_multiple_members_rejected(self):
        with self.assertRaises(p.ValidationError):
            p.parse_source(self.make_archive(extra=True))

    def test_compressed_and_uncompressed_limits(self):
        archive = self.make_archive()
        for constant in ("MAX_ARCHIVE_BYTES", "MAX_TAR_BYTES", "MAX_SQL_BYTES"):
            with self.subTest(limit=constant), patch.object(p, constant, 10), self.assertRaises(p.ValidationError):
                p.parse_source(archive)
        plain = self.root / "source.sql"
        plain.write_bytes(fixture(valid_data()).encode())
        with patch.object(p, "MAX_SQL_BYTES", 10), self.assertRaises(p.ValidationError):
            p.parse_source(plain)

    def test_truncated_invalid_or_concatenated_archive_rejected(self):
        archive = self.make_archive()
        raw = archive.read_bytes()
        for corrupt in (raw[:-20], b"not xz", raw + raw):
            archive.write_bytes(corrupt)
            with self.assertRaises(p.ValidationError):
                p.parse_source(archive)

    def test_invalid_utf8_rejected(self):
        with self.assertRaises(p.ValidationError):
            p.parse_source(self.make_archive(contents=b"\xff"))


if __name__ == "__main__":
    unittest.main()
