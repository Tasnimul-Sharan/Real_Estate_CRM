"""Read a known MySQL analytics dump; emit business data only. Never executes SQL.

Deliberately fail closed on schema/statement drift. This is not a generic SQL engine.
Amounts preserve the decimal text in the dump, not unavailable pre-DOUBLE precision.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tarfile
import lzma

MAX_SQL_BYTES = 50 * 1024 * 1024
MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_TAR_BYTES = MAX_SQL_BYTES + 1024 * 1024
NUMBER_PATTERN = re.compile(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?")
WORD_PATTERN = re.compile(r"[A-Za-z_][A-Za-z_0-9$]*")
SOURCE_DATABASE = "bridge_analytics_prod"
BUSINESS_TABLES = ("company", "sale_daily", "sale_monthly", "target_daily", "target_monthly", "target_yearly")
ID = "int NOT NULL AUTO_INCREMENT"
COMPANY_ID = "int DEFAULT NULL"
TEXT = "varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL"
DAY = "date NOT NULL COMMENT '(DC2Type:date_immutable)'"
MONEY = "double NOT NULL"
SCHEMA = {
    "company": [("id", ID), ("name", TEXT), ("biznet_id", "smallint DEFAULT NULL"), ("legacy_id", "smallint DEFAULT NULL"), ("biznet_start", "date DEFAULT NULL COMMENT '(DC2Type:date_immutable)'")],
    "eit_system": [("id", ID), ("company_id", COMPANY_ID), ("eit_key", TEXT), ("eit_value", "json NOT NULL")],
    "pnl": [("id", ID), ("company_id", COMPANY_ID), ("data", "json NOT NULL"), ("month", "smallint DEFAULT NULL"), ("year", "smallint DEFAULT NULL")],
    "sale_daily": [("id", ID), ("company_id", COMPANY_ID), ("date", DAY), ("amount", MONEY), ("due", MONEY), ("od", MONEY), ("cod_od", MONEY)],
    "sale_monthly": [("id", ID), ("company_id", COMPANY_ID), ("month", "smallint NOT NULL"), ("year", "int NOT NULL"), ("amount", MONEY), ("due", MONEY), ("od", MONEY), ("cod_od", MONEY)],
    "target_daily": [("id", ID), ("company_id", COMPANY_ID), ("date", DAY), ("amount", MONEY)],
    "target_monthly": [("id", ID), ("company_id", COMPANY_ID), ("month", "smallint NOT NULL"), ("year", "int NOT NULL"), ("amount", MONEY)],
    "target_yearly": [("id", ID), ("company_id", COMPANY_ID), ("year", TEXT), ("amount", MONEY)],
    "user": [("id", ID), ("username", TEXT), ("password", TEXT), ("roles", "json NOT NULL"), ("enabled", "tinyint(1) NOT NULL DEFAULT '1'")],
    "user_key": [("id", ID), ("user_id", COMPANY_ID), ("name", TEXT), ("hash", TEXT)],
}
INDEX_IDS = {"eit_system": "A18C26A1979B1AD6", "pnl": "14CADA18979B1AD6", "sale_daily": "5E41F3E9979B1AD6", "sale_monthly": "9FBB040A979B1AD6", "target_daily": "32363066979B1AD6", "target_monthly": "21CD7FF3979B1AD6", "target_yearly": "F149234C979B1AD6", "user_key": "6186CA22A76ED395"}


class ValidationError(ValueError):
    """Error messages intentionally never contain raw SQL or credential values."""


@dataclass(frozen=True)
class Token:
    kind: str
    value: str


def lex(sql: str, comments: list[str] | None = None):
    """Quote-aware mysqldump lexer, including MySQL versioned comments."""
    i = 0
    while i < len(sql):
        c = sql[i]
        if c.isspace():
            i += 1
            continue
        if c == "#" or (sql.startswith("--", i) and (i + 2 == len(sql) or sql[i + 2].isspace())):
            end = sql.find("\n", i)
            end = len(sql) if end < 0 else end
            if comments is not None:
                comments.append(sql[i:end].rstrip("\r"))
            i = end
            continue
        if sql.startswith("/*", i):
            end = sql.find("*/", i + 2)
            if end < 0:
                raise ValidationError("Unterminated SQL comment")
            body = sql[i + 2:end]
            if body.startswith("!"):
                body = re.sub(r"^!\d{5,6}\s*", "", body)
                if body.startswith("!"):
                    raise ValidationError("Unsupported versioned comment")
                yield from lex(body)
            i = end + 2
            continue
        if c in "'\"`":
            quote = c
            value = []
            i += 1
            while i < len(sql):
                c = sql[i]
                if c == quote:
                    if i + 1 < len(sql) and sql[i + 1] == quote:
                        value.append(quote)
                        i += 2
                        continue
                    i += 1
                    break
                if c == "\\" and quote != "`":
                    i += 1
                    if i >= len(sql):
                        raise ValidationError("Unterminated SQL escape")
                    c = sql[i]
                    escapes = {"0": "\0", "b": "\b", "n": "\n", "r": "\r", "t": "\t", "Z": "\x1a", "%": "\\%", "_": "\\_"}
                    value.append(escapes.get(c, c))
                else:
                    value.append(c)
                i += 1
            else:
                raise ValidationError("Unterminated SQL quoted value")
            yield Token("ident" if quote == "`" else "str", "".join(value))
            continue
        match = NUMBER_PATTERN.match(sql, i)
        if match:
            value = match.group()
            yield Token("num", value)
            i += len(value)
            continue
        match = WORD_PATTERN.match(sql, i)
        if match:
            value = match.group()
            yield Token("word", value.upper())
            i += len(value)
            continue
        if c in "(),;=@.*":
            yield Token("sym", c)
            i += 1
            continue
        raise ValidationError("Unsupported SQL token")


def tokens(text):
    return list(lex(text))


def statements(sql, comments):
    pending = []
    for token in lex(sql, comments):
        if token == Token("sym", ";"):
            if pending:
                yield pending
            pending = []
        else:
            pending.append(token)
    if pending:
        raise ValidationError("SQL statement missing terminator")


def expected_create(table):
    clauses = [f"`{column}` {definition}" for column, definition in SCHEMA[table]]
    clauses.append("PRIMARY KEY (`id`)")
    if table in INDEX_IDS:
        field, parent = ("user_id", "user") if table == "user_key" else ("company_id", "company")
        index = INDEX_IDS[table]
        clauses.extend([f"KEY `IDX_{index}` (`{field}`)", f"CONSTRAINT `FK_{index}` FOREIGN KEY (`{field}`) REFERENCES `{parent}` (`id`)"])
    if table == "user":
        clauses.append("UNIQUE KEY `UNIQ_8D93D649F85E0677` (`username`)")
    return f"CREATE TABLE `{table}` (" + ", ".join(clauses) + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"


SET_STATEMENTS = [
    "SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT", "SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS", "SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION", "SET NAMES utf8mb4", "SET @OLD_TIME_ZONE=@@TIME_ZONE", "SET TIME_ZONE='+00:00'", "SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0", "SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0", "SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO'", "SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0", "SET @saved_cs_client=@@character_set_client", "SET character_set_client=utf8mb4", "SET character_set_client=@saved_cs_client", "SET TIME_ZONE=@OLD_TIME_ZONE", "SET SQL_MODE=@OLD_SQL_MODE", "SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS", "SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS", "SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT", "SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS", "SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION", "SET SQL_NOTES=@OLD_SQL_NOTES",
]
ALLOWED_SET = {tuple(tokens(item)) for item in SET_STATEMENTS}


def require_table(token):
    if token.kind != "ident" or token.value not in SCHEMA:
        raise ValidationError("Unknown table or unsupported table identifier")
    return token.value


def validate_create(statement):
    if len(statement) < 3:
        raise ValidationError("Incomplete table definition")
    table = require_table(statement[2])
    # AUTO_INCREMENT counter changes naturally between snapshots; its column
    # attribute and every other DDL token must still match exactly.
    filtered = list(statement)
    engine = tokens("ENGINE=InnoDB")
    positions = [i for i in range(len(statement)) if statement[i:i + len(engine)] == engine]
    if len(positions) == 1:
        i = positions[0] + len(engine)
        if statement[i:i + 2] == tokens("AUTO_INCREMENT="):
            if i + 2 >= len(statement) or statement[i + 2].kind != "num" or not re.fullmatch(r"[1-9]\d*", statement[i + 2].value):
                raise ValidationError("Invalid AUTO_INCREMENT counter")
            del filtered[i:i + 3]
    if filtered != tokens(expected_create(table)):
        raise ValidationError(f"Schema drift in table {table}")
    return table


def scalar(token, definition, column, table):
    nullable = "NOT NULL" not in definition
    if token == Token("word", "NULL"):
        if not nullable:
            raise ValidationError(f"Unexpected NULL in {table}.{column}")
        return None
    if definition.startswith(("int", "smallint", "tinyint")):
        if token.kind != "num" or not re.fullmatch(r"[+-]?\d+", token.value):
            raise ValidationError(f"Invalid integer in {table}.{column}")
        value = int(token.value)
        lower, upper = (-32768, 32767) if definition.startswith("smallint") else (-2147483648, 2147483647)
        if column in ("id", "company_id", "user_id"):
            lower = 1
        if column == "month":
            lower, upper = 1, 12
        if column == "year":
            lower, upper = 1000, 9999
        if column == "enabled":
            lower, upper = 0, 1
        if not lower <= value <= upper:
            raise ValidationError(f"Integer outside supported range in {table}.{column}")
        return value
    if definition.startswith("double"):
        if token.kind != "num" or len(token.value) > 150:
            raise ValidationError(f"Invalid decimal in {table}.{column}")
        try:
            value = Decimal(token.value)
        except InvalidOperation as exc:
            raise ValidationError(f"Invalid decimal in {table}.{column}") from exc
        if not value.is_finite() or abs(value.as_tuple().exponent) > 100 or len(value.as_tuple().digits) > 100 or value.adjusted() >= 100:
            raise ValidationError(f"Decimal outside supported precision in {table}.{column}")
        rendered = format(value, "f")
        if "." in rendered:
            rendered = rendered.rstrip("0").rstrip(".")
        return "0" if value == 0 else rendered
    if token.kind != "str" or "\0" in token.value:
        raise ValidationError(f"Invalid text in {table}.{column}")
    value = token.value
    if definition.startswith("date"):
        try:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError()
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValidationError(f"Invalid date in {table}.{column}") from exc
    elif definition.startswith("json"):
        try:
            json.loads(value, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, RecursionError) as exc:
            raise ValidationError(f"Invalid JSON in {table}.{column}") from exc
    elif len(value) > 255:
        raise ValidationError(f"Text exceeds column size in {table}.{column}")
    if table == "target_yearly" and column == "year":
        year_match = re.fullmatch(r"([1-9]\d{3})(?:-([1-9]\d{3}))?", value)
        if not year_match or (year_match[2] and int(year_match[2]) != int(year_match[1]) + 1):
            raise ValidationError("Invalid target_yearly.year")
    return value


def insert_rows(statement, table):
    i = 3
    columns = SCHEMA[table]
    if i < len(statement) and statement[i] == Token("sym", "("):
        explicit = [Token("sym", "(")]
        for n, (name, _) in enumerate(columns):
            if n:
                explicit.append(Token("sym", ","))
            explicit.append(Token("ident", name))
        explicit.append(Token("sym", ")"))
        if statement[i:i + len(explicit)] != explicit:
            raise ValidationError(f"INSERT column drift in {table}")
        i += len(explicit)
    if i >= len(statement) or statement[i] != Token("word", "VALUES"):
        raise ValidationError(f"Unsupported INSERT in {table}")
    i += 1
    count = 0
    while i < len(statement):
        if statement[i] != Token("sym", "("):
            raise ValidationError(f"Invalid row opening in {table}")
        i += 1
        row = {}
        for n, (name, definition) in enumerate(columns):
            if n:
                if i >= len(statement) or statement[i] != Token("sym", ","):
                    raise ValidationError(f"Invalid column separator in {table}")
                i += 1
            if i >= len(statement):
                raise ValidationError(f"Incomplete row in {table}")
            row[name] = scalar(statement[i], definition, name, table)
            i += 1
        if i >= len(statement) or statement[i] != Token("sym", ")"):
            raise ValidationError(f"Invalid row length or expression in {table}")
        i += 1
        count += 1
        yield row
        if i == len(statement):
            break
        if statement[i] != Token("sym", ",") or i + 1 == len(statement):
            raise ValidationError(f"Invalid row separator in {table}")
        i += 1
    if not count:
        raise ValidationError(f"Empty INSERT in {table}")


def read_source(path: Path):
    path = Path(path)
    if path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValidationError("Input exceeds size limit")
    with path.open("rb") as handle:
        raw = handle.read(MAX_ARCHIVE_BYTES + 1)
    if len(raw) > MAX_ARCHIVE_BYTES:
        raise ValidationError("Input exceeds size limit")
    archive_hash = None
    if path.name.endswith(".sql.tar.xz"):
        archive_hash = hashlib.sha256(raw).hexdigest()
        try:
            decoder = lzma.LZMADecompressor(memlimit=128 * 1024 * 1024)
            unpacked = decoder.decompress(raw, max_length=MAX_TAR_BYTES + 1)
            if len(unpacked) > MAX_TAR_BYTES or not decoder.eof or decoder.unused_data:
                raise ValidationError("Archive is oversized, incomplete or has trailing streams")
            with tarfile.open(fileobj=io.BytesIO(unpacked), mode="r:") as archive:
                members = archive.getmembers()
                if len(members) != 1:
                    raise ValidationError("Archive must contain exactly one SQL file")
                member = members[0]
                if not member.isfile() or not re.fullmatch(r"[A-Za-z0-9_.-]+\.sql", member.name) or member.pax_headers:
                    raise ValidationError("Unsafe or unsupported archive member")
                if member.size > MAX_SQL_BYTES:
                    raise ValidationError("SQL member exceeds size limit")
                with archive.extractfile(member) as handle:
                    sql_bytes = handle.read(MAX_SQL_BYTES + 1)
                if len(sql_bytes) != member.size or len(sql_bytes) > MAX_SQL_BYTES:
                    raise ValidationError("SQL member size mismatch")
        except (lzma.LZMAError, tarfile.TarError, EOFError) as exc:
            raise ValidationError("Invalid compressed SQL archive") from exc
    elif path.suffix == ".sql":
        sql_bytes = raw
    else:
        raise ValidationError("Expected .sql or .sql.tar.xz input")
    if len(sql_bytes) > MAX_SQL_BYTES:
        raise ValidationError("SQL input exceeds size limit")
    try:
        sql = sql_bytes.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        raise ValidationError("Dump is not valid UTF-8") from exc
    return sql, hashlib.sha256(sql_bytes).hexdigest(), archive_hash


def parse_dump(sql: str, source_file: str, sql_sha256: str, archive_sha256: str | None = None):
    comments, seen, counts = [], set(), {table: 0 for table in SCHEMA}
    business = {table: [] for table in BUSINESS_TABLES}
    ids = {table: set() for table in SCHEMA}
    business_keys = {table: set() for table in SCHEMA}
    references, user_references = [], []
    for statement in statements(sql, comments):
        if statement[:2] == tokens("CREATE TABLE"):
            table = validate_create(statement)
            if table in seen:
                raise ValidationError(f"Repeated table definition: {table}")
            seen.add(table)
        elif statement[:2] == tokens("INSERT INTO"):
            if len(statement) < 4:
                raise ValidationError("Incomplete INSERT")
            table = require_table(statement[2])
            if table not in seen:
                raise ValidationError(f"INSERT before schema: {table}")
            for row in insert_rows(statement, table):
                counts[table] += 1
                if table in ("eit_system", "pnl"):
                    raise ValidationError(f"Nonempty {table} requires a new migration mapping")
                if row["id"] in ids[table]:
                    raise ValidationError(f"Duplicate source ID in {table}")
                ids[table].add(row["id"])
                if "company_id" in row and row["company_id"] is not None:
                    references.append((table, row["company_id"]))
                if table == "user_key" and row["user_id"] is not None:
                    user_references.append(row["user_id"])
                key = None
                if table.endswith("_daily"):
                    key = (row["company_id"], row["date"])
                elif table.endswith("_monthly"):
                    key = (row["company_id"], row["year"], row["month"])
                elif table == "target_yearly":
                    key = (row["company_id"], row["year"])
                elif table == "user":
                    key = row["username"].casefold()
                if key is not None:
                    if key in business_keys[table]:
                        raise ValidationError(f"Duplicate business key in {table}")
                    business_keys[table].add(key)
                if table in business:
                    business[table].append(row)
                # Authentication rows never enter the output manifest.
        elif statement[:1] == tokens("SET"):
            if tuple(statement) not in ALLOWED_SET:
                raise ValidationError("Unsupported SET statement")
        elif statement[:4] == tokens("DROP TABLE IF EXISTS"):
            if len(statement) != 5:
                raise ValidationError("Unsupported DROP statement")
            table = require_table(statement[4])
            if table in seen:
                raise ValidationError("DROP after table definition is not a supported dump")
        elif statement[:2] == tokens("LOCK TABLES"):
            if len(statement) != 4 or statement[3] != Token("word", "WRITE"):
                raise ValidationError("Unsupported LOCK statement")
            require_table(statement[2])
        elif statement == tokens("UNLOCK TABLES"):
            pass
        elif statement[:2] == tokens("ALTER TABLE"):
            if len(statement) != 5 or statement[3:] not in (tokens("DISABLE KEYS"), tokens("ENABLE KEYS")):
                raise ValidationError("Unsupported ALTER statement")
            require_table(statement[2])
        else:
            raise ValidationError("Unsupported SQL statement; review the source before migrating")
    if seen != set(SCHEMA):
        raise ValidationError("Missing expected table definitions")
    for table, company_id in references:
        if company_id not in ids["company"]:
            raise ValidationError(f"Missing company reference in {table}")
    if any(user_id not in ids["user"] for user_id in user_references):
        raise ValidationError("Missing user reference in excluded authentication data")
    databases = [match.group(1) for comment in comments if (match := re.fullmatch(r"-- Host:.*?\s+Database:\s*(\S+)\s*", comment))]
    if databases != [SOURCE_DATABASE]:
        raise ValidationError("Missing, ambiguous or unexpected source database header")
    footers = [match.groups() for comment in comments if (match := re.fullmatch(r"-- Dump completed on (\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}:\d{2})\s*", comment))]
    if len(footers) != 1:
        raise ValidationError("Missing or ambiguous dump completion timestamp")
    try:
        snapshot = datetime.strptime(" ".join(footers[0]), "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
    except ValueError as exc:
        raise ValidationError("Invalid dump completion timestamp") from exc
    for rows in business.values():
        rows.sort(key=lambda row: row["id"])
    return {"formatVersion": 1, "sourceDatabase": SOURCE_DATABASE, "sourceFile": Path(source_file).name, "sqlSha256": sql_sha256, "archiveSha256": archive_sha256, "snapshotAt": snapshot, "sourceCounts": counts, "tables": business}


def parse_source(path):
    sql, sql_hash, archive_hash = read_source(Path(path))
    return parse_dump(sql, Path(path).name, sql_hash, archive_hash)


def summary(manifest):
    ranges = {}
    for name, rows in manifest["tables"].items():
        if name.endswith("_daily") and rows:
            dates = [row["date"] for row in rows]
            ranges[name] = {"from": min(dates), "to": max(dates)}
        elif name.endswith("_monthly") and rows:
            periods = [f"{row['year']:04}-{row['month']:02}" for row in rows]
            ranges[name] = {"from": min(periods), "to": max(periods)}
        elif name == "target_yearly" and rows:
            years = [row["year"] for row in rows]
            ranges[name] = {"from": min(years), "to": max(years)}
    return {"sourceDatabase": manifest["sourceDatabase"], "snapshotAt": manifest["snapshotAt"], "snapshotTimezone": "unknown", "sourceCounts": manifest["sourceCounts"], "importedBusinessRows": sum(map(len, manifest["tables"].values())), "ranges": ranges}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        if args.input.resolve() == args.output.resolve():
            raise ValidationError("Output must not overwrite the source backup")
        manifest = parse_source(args.input)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(summary(manifest), ensure_ascii=False, indent=2))
    except (ValidationError, OSError) as exc:
        print(f"Migration input rejected: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
