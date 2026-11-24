#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const { Prisma } = require("@prisma/client");

// The largest accepted number has 200 digits. Even 500,000 such values sum
// exactly at this precision. A clone avoids changing the application's Decimal.
const Money = Prisma.Decimal.clone({ precision: 256 });
const TABLES = Object.freeze({
  company: ["id", "name", "biznet_id", "legacy_id", "biznet_start"],
  sale_daily: ["id", "company_id", "date", "amount", "due", "od", "cod_od"],
  sale_monthly: ["id", "company_id", "month", "year", "amount", "due", "od", "cod_od"],
  target_daily: ["id", "company_id", "date", "amount"],
  target_monthly: ["id", "company_id", "month", "year", "amount"],
  target_yearly: ["id", "company_id", "year", "amount"],
});
const ALL_TABLES = [...Object.keys(TABLES), "eit_system", "pnl", "user", "user_key"];
const MAX_RECORDS = 500000;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;

class ManifestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ManifestError";
  }
}
function ensure(condition, message) {
  if (!condition) throw new ManifestError(message);
}
function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exactKeys(value, keys, location) {
  ensure(plain(value), `${location}: expected an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  // Do not print unknown field names: they could contain sensitive material.
  ensure(actual.length === expected.length && actual.every((key, i) => key === expected[i]),
    `${location}: unsupported or missing fields`);
}
function integer(value, min, max, location) {
  ensure(Number.isSafeInteger(value) && value >= min && value <= max, `${location}: invalid integer`);
}
function validDate(value, location) {
  ensure(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), `${location}: expected YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  ensure(year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1],
    `${location}: invalid calendar date`);
}
function decimal(value, location) {
  ensure(typeof value === "string" && value.length <= 220 &&
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d{1,3})?$/.test(value),
  `${location}: expected a finite decimal string`);
  const result = new Money(value);
  ensure(result.isFinite() && result.precision() <= 200 && result.decimalPlaces() <= 100 &&
    (result.isZero() || result.e <= 99), `${location}: decimal exceeds supported precision`);
  return result;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function validateManifest(manifest) {
  exactKeys(manifest, ["formatVersion", "sourceDatabase", "sourceFile", "sqlSha256", "archiveSha256", "snapshotAt", "sourceCounts", "tables"], "manifest");
  ensure(manifest.formatVersion === 1, "manifest: unsupported format version");
  ensure(manifest.sourceDatabase === "bridge_analytics_prod", "manifest: unsupported source database");
  ensure(typeof manifest.sourceFile === "string" && manifest.sourceFile.length >= 1 && manifest.sourceFile.length <= 255 &&
    !/[\\/:\x00-\x1f\x7f]/.test(manifest.sourceFile) && ![".", ".."].includes(manifest.sourceFile),
  "sourceFile: expected a basename without control characters");
  ensure(typeof manifest.sqlSha256 === "string" && SHA256.test(manifest.sqlSha256), "sqlSha256: invalid SHA-256 digest");
  ensure(manifest.archiveSha256 === null || (typeof manifest.archiveSha256 === "string" && SHA256.test(manifest.archiveSha256)),
    "archiveSha256: invalid SHA-256 digest");
  ensure(typeof manifest.snapshotAt === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(manifest.snapshotAt),
    "snapshotAt: expected YYYY-MM-DD HH:mm:ss with unknown source timezone");
  validDate(manifest.snapshotAt.slice(0, 10), "snapshotAt");
  const [hour, minute, second] = manifest.snapshotAt.slice(11).split(":").map(Number);
  ensure(hour <= 23 && minute <= 59 && second <= 59, "snapshotAt: invalid clock time");
  exactKeys(manifest.sourceCounts, ALL_TABLES, "sourceCounts");
  for (const table of ALL_TABLES) integer(manifest.sourceCounts[table], 0, MAX_RECORDS, `sourceCounts.${table}`);
  ensure(manifest.sourceCounts.eit_system === 0 && manifest.sourceCounts.pnl === 0,
    "Unsupported populated eit_system or pnl table; extend the mapping before importing");
  exactKeys(manifest.tables, Object.keys(TABLES), "tables");
  const companyIds = new Set();
  const records = [];
  const summaries = {};
  const normalizedTables = {};
  for (const [table, columns] of Object.entries(TABLES)) {
    const rows = manifest.tables[table];
    ensure(Array.isArray(rows) && rows.length <= MAX_RECORDS, `${table}: expected a bounded array`);
    ensure(rows.length === manifest.sourceCounts[table], `${table}: source count mismatch`);
    ensure(records.length + rows.length <= MAX_RECORDS, "manifest: too many records");
    const ids = new Set();
    const naturalKeys = new Set();
    const sums = {};
    for (const field of columns.filter(column => ["amount", "due", "od", "cod_od"].includes(column))) sums[field] = new Money(0);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const location = `${table}[${i}]`;
      exactKeys(row, columns, location);
      integer(row.id, 1, 2147483647, `${location}.id`);
      ensure(!ids.has(row.id), `${table}: duplicate source ID`);
      ids.add(row.id);
      if (table === "company") {
        ensure(typeof row.name === "string" && [...row.name].length >= 1 && [...row.name].length <= 255 &&
          !/[\x00-\x1f\x7f]/.test(row.name), `${location}.name: invalid company name`);
        for (const field of ["biznet_id", "legacy_id"]) {
          if (row[field] !== null) integer(row[field], -32768, 32767, `${location}.${field}`);
        }
        if (row.biznet_start !== null) validDate(row.biznet_start, `${location}.biznet_start`);
        companyIds.add(row.id);
      } else {
        if (row.company_id !== null) {
          integer(row.company_id, 1, 2147483647, `${location}.company_id`);
          ensure(companyIds.has(row.company_id), `${location}: unknown company reference`);
        }
        let period;
        if (columns.includes("date")) {
          validDate(row.date, `${location}.date`);
          period = row.date;
        } else if (table === "target_yearly") {
          ensure(typeof row.year === "string" && /^[1-9]\d{3}(?:-[1-9]\d{3})?$/.test(row.year), `${location}.year: invalid year`);
          if (row.year.includes("-")) ensure(Number(row.year.slice(5)) === Number(row.year.slice(0, 4)) + 1,
            `${location}.year: fiscal year must span consecutive years`);
          period = row.year;
        } else {
          integer(row.month, 1, 12, `${location}.month`);
          integer(row.year, 1000, 9999, `${location}.year`);
          period = `${row.year}-${String(row.month).padStart(2, "0")}`;
        }
        const key = `${row.company_id === null ? "null" : row.company_id}:${period}`;
        ensure(!naturalKeys.has(key), `${table}: duplicate company and period`);
        naturalKeys.add(key);
        for (const field of Object.keys(sums)) sums[field] = sums[field].plus(decimal(row[field], `${location}.${field}`));
      }
      // Copy validated plain values to avoid changing any caller-owned object.
      records.push({ tableName: table, sourceId: String(row.id), data: { ...row } });
    }
    normalizedTables[table] = [...rows].sort((a, b) => a.id - b.id);
    summaries[table] = { count: rows.length };
    if (Object.keys(sums).length) summaries[table].sums = Object.fromEntries(Object.entries(sums).map(([key, value]) => [key, value.toFixed()]));
  }
  const payload = {
    formatVersion: manifest.formatVersion,
    sourceDatabase: manifest.sourceDatabase,
    sqlSha256: manifest.sqlSha256,
    snapshotAt: manifest.snapshotAt,
    sourceCounts: manifest.sourceCounts,
    tables: normalizedTables,
  };
  const reconciliation = {
    formatVersion: 1,
    manifestSha256: crypto.createHash("sha256").update(canonical(payload)).digest("hex"),
    recordCount: records.length,
    excludedCounts: { user: manifest.sourceCounts.user, user_key: manifest.sourceCounts.user_key },
    tables: summaries,
    warnings: [
      "Source timestamp timezone is unknown; preserve the wall-clock value.",
      "Sales and targets are legacy aggregates, not CRM customer transactions.",
      "Sums of due, od, and cod_od are reconciliation checks, not customer outstanding balances.",
      "Legacy authentication data is excluded. CRM users and permissions are unchanged.",
    ],
  };
  return { records, reconciliation };
}

function existingResult(existing, reconciliation) {
  ensure(existing.reconciliation && existing.reconciliation.manifestSha256 === reconciliation.manifestSha256,
    "SQL hash already exists with different validated content; refusing to replace the snapshot");
  return { status: "unchanged", id: existing.id, recordCount: existing.recordCount, reconciliation: existing.reconciliation };
}
async function importManifest(prisma, manifest, options = {}) {
  const { records, reconciliation } = validateManifest(manifest);
  if (options.apply !== true) return { status: "dry-run", recordCount: records.length, reconciliation };
  ensure(prisma && typeof prisma.$transaction === "function", "A Prisma client is required for --apply");
  const where = { sourceSha256: manifest.sqlSha256 };
  try {
    return await prisma.$transaction(async tx => {
      const existing = await tx.legacyImport.findUnique({ where });
      if (existing) return existingResult(existing, reconciliation);
      const created = await tx.legacyImport.create({ data: {
        sourceDatabase: manifest.sourceDatabase,
        sourceFile: manifest.sourceFile,
        sourceSha256: manifest.sqlSha256,
        archiveSha256: manifest.archiveSha256,
        snapshotAt: manifest.snapshotAt,
        recordCount: records.length,
        sourceCounts: manifest.sourceCounts,
        reconciliation,
      } });
      for (let offset = 0; offset < records.length; offset += 500) {
        await tx.legacyRecord.createMany({ data: records.slice(offset, offset + 500).map(record => ({ ...record, importId: created.id })) });
      }
      return { status: "imported", id: created.id, recordCount: records.length, reconciliation };
    }, { maxWait: 10000, timeout: 120000 });
  } catch (error) {
    // A concurrent import may win the unique SQL hash constraint. The losing
    // transaction is rolled back before checking the winner's content.
    if (error && error.code === "P2002") {
      const existing = await prisma.legacyImport.findUnique({ where });
      if (existing) return existingResult(existing, reconciliation);
    }
    throw error;
  }
}
function readManifest(input) {
  const stat = fs.statSync(input);
  ensure(stat.isFile() && stat.size > 0 && stat.size <= MAX_INPUT_BYTES, "Input must be a JSON file of at most 64 MiB");
  try {
    return JSON.parse(fs.readFileSync(input, "utf8"));
  } catch (_) {
    throw new ManifestError("Input could not be parsed as JSON");
  }
}
async function main(argv = process.argv.slice(2)) {
  let input;
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && !input && argv[i + 1] && !argv[i + 1].startsWith("--")) input = argv[++i];
    else if (argv[i] === "--apply" && !apply) apply = true;
    else throw new ManifestError("Usage: node scripts/import-legacy.cjs --input manifest.json [--apply]");
  }
  ensure(input, "Usage: node scripts/import-legacy.cjs --input manifest.json [--apply]");
  const manifest = readManifest(input);
  // Complete validation before initializing a database client.
  validateManifest(manifest);
  let prisma;
  try {
    if (apply) {
      const { PrismaClient } = require("@prisma/client");
      prisma = new PrismaClient();
    }
    const result = await importManifest(prisma, manifest, { apply });
    console.log(JSON.stringify({
      status: result.status, importId: result.id || null, snapshotAt: manifest.snapshotAt,
      sourceTimezone: "unknown", recordCount: result.recordCount,
      counts: Object.fromEntries(Object.entries(result.reconciliation.tables).map(([table, value]) => [table, value.count])),
      excludedCounts: result.reconciliation.excludedCounts,
    }, null, 2));
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}
module.exports = { TABLES, MAX_RECORDS, ManifestError, validateManifest, importManifest, readManifest, main };
if (require.main === module) {
  main().catch(error => {
    // Prisma errors can include connection URLs and payloads; never log them.
    console.error(error instanceof ManifestError ? error.message : "Legacy import failed; no partial snapshot was committed. Check database availability and migration status.");
    process.exitCode = 1;
  });
}
