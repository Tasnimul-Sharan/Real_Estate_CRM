"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateManifest, importManifest, ManifestError } = require("../scripts/import-legacy.cjs");
const { fixture } = require("./legacy-fixture.cjs");

test("preserves decimal strings above JS integer precision and reconciles exactly", () => {
  const source = fixture();
  const before = JSON.stringify(source);
  const result = validateManifest(source);
  assert.equal(result.records.length, 7);
  assert.equal(result.records.find(row => row.tableName === "sale_daily").data.amount, "9007199254740993.01");
  assert.deepEqual(result.reconciliation.tables.sale_daily.sums,
    { amount: "9007199254740993.03", due: "0.3", od: "0.1", cod_od: "1.001" });
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(result.reconciliation.excludedCounts, { user: 2, user_key: 1 });
  assert.ok(!result.records.some(row => ["user", "user_key"].includes(row.tableName)));
});

test("repacking or reordering the same source does not change its content digest", () => {
  const a = fixture();
  const b = fixture();
  b.sourceFile = "renamed.sql";
  b.archiveSha256 = null;
  b.tables.sale_daily.reverse();
  assert.equal(validateManifest(a).reconciliation.manifestSha256, validateManifest(b).reconciliation.manifestSha256);
  b.tables.sale_daily[0].amount = "88";
  assert.notEqual(validateManifest(a).reconciliation.manifestSha256, validateManifest(b).reconciliation.manifestSha256);
});

test("dry-run is the default and never reads or writes a database client", async () => {
  const poisonClient = new Proxy({}, { get() { throw new Error("DB must not be used"); } });
  const result = await importManifest(poisonClient, fixture());
  assert.equal(result.status, "dry-run");
});

test("CLI dry-run succeeds with an invalid database URL and prints no data values", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crm-legacy-unit-"));
  const file = path.join(directory, "manifest.json");
  try {
    fs.writeFileSync(file, JSON.stringify(fixture()));
    const result = spawnSync(process.execPath, [path.join(__dirname, "../scripts/import-legacy.cjs"), "--input", file], {
      encoding: "utf8", env: { ...process.env, DATABASE_URL: "not-a-database" },
    });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.status, "dry-run");
    assert.equal(output.recordCount, 7);
    assert.ok(!result.stdout.includes("Synthetic migration fixture"));
    assert.ok(!result.stdout.includes("9007199254740993"));
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
});

const invalidCases = {
  "foreign database": m => { m.sourceDatabase = "another_database"; },
  "unsupported version": m => { m.formatVersion = 2; },
  "file path": m => { m.sourceFile = "../source.sql"; },
  "malformed SQL hash": m => { m.sqlSha256 = "short"; },
  "malformed archive hash": m => { m.archiveSha256 = 42; },
  "timezone conversion": m => { m.snapshotAt = "2026-10-18T05:30:01Z"; },
  "invalid snapshot date": m => { m.snapshotAt = "2026-02-30 05:30:01"; },
  "invalid snapshot clock": m => { m.snapshotAt = "2026-10-18 25:00:00"; },
  "credentials table": m => { m.tables.user = []; },
  "credential field": m => { m.tables.company[0].password = "sensitive"; },
  "unexpected manifest field": m => { m.username = "sensitive"; },
  "missing field": m => { delete m.tables.company[0].name; },
  "source count mismatch": m => { m.sourceCounts.sale_daily++; },
  "populated unsupported table": m => { m.sourceCounts.pnl = 1; },
  "populated config table": m => { m.sourceCounts.eit_system = 1; },
  "missing count": m => { delete m.sourceCounts.user; },
  "negative count": m => { m.sourceCounts.user = -1; },
  "unsafe source ID": m => { m.tables.company[0].id = 2147483648; },
  "duplicate source ID": m => { m.tables.sale_daily[1].id = 1; },
  "duplicate period": m => { m.tables.sale_daily[1].date = "2026-10-01"; },
  "unknown company": m => { m.tables.sale_daily[0].company_id = 2; },
  "fractional company": m => { m.tables.sale_daily[0].company_id = 1.5; },
  "invalid calendar date": m => { m.tables.sale_daily[0].date = "2026-02-29"; },
  "invalid month": m => { m.tables.sale_monthly[0].month = 13; },
  "year outside supported calendar": m => { m.tables.sale_monthly[0].year = 1; },
  "invalid fiscal year": m => { m.tables.target_yearly[0].year = "2025-2027"; },
  "overlong company name": m => { m.tables.company[0].name = "a".repeat(256); },
  "company control character": m => { m.tables.company[0].name = "test\u0000"; },
  "invalid smallint": m => { m.tables.company[0].biznet_id = 32768; },
  "invalid start date": m => { m.tables.company[0].biznet_start = "not-a-date"; },
  "numeric money": m => { m.tables.sale_daily[0].amount = 0.1; },
  "NaN money": m => { m.tables.sale_daily[0].amount = "NaN"; },
  "infinite money": m => { m.tables.sale_daily[0].amount = "Infinity"; },
  "money whitespace": m => { m.tables.sale_daily[0].amount = " 10"; },
  "money SQL": m => { m.tables.sale_daily[0].amount = "1); DROP TABLE users;"; },
  "excess decimal magnitude": m => { m.tables.sale_daily[0].amount = "1e100"; },
  "excess decimal scale": m => { m.tables.sale_daily[0].amount = "1e-101"; },
  "array instead of object": m => { m.tables.company[0] = []; },
};
for (const [name, mutate] of Object.entries(invalidCases)) {
  test(`rejects ${name}`, () => {
    const manifest = fixture(); mutate(manifest);
    assert.throws(() => validateManifest(manifest), ManifestError);
  });
}

test("preserves nullable company references, leap dates and calendar-year labels", () => {
  const manifest = fixture();
  manifest.tables.sale_daily[0].company_id = null;
  manifest.tables.sale_daily[0].date = "2024-02-29";
  manifest.tables.target_yearly[0].year = "2026";
  assert.equal(validateManifest(manifest).records.length, 7);
});
