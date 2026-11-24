"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { importManifest, ManifestError } = require("../scripts/import-legacy.cjs");
const { fixture } = require("./legacy-fixture.cjs");

// Opt-in only. These tests add and remove their own synthetic snapshots in an
// explicitly named disposable database; never run against the real CRM DB.
test("PostgreSQL legacy import transaction and idempotency", { skip: process.env.RUN_LEGACY_INTEGRATION !== "1" }, async t => {
  const url = new URL(process.env.DATABASE_URL || "postgresql://invalid/invalid");
  assert.ok(["postgresql:", "postgres:"].includes(url.protocol), "PostgreSQL required");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), "realestate_crm_test", "Refusing to test outside realestate_crm_test");
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const prefix = `legacy-integration-${crypto.randomUUID()}`;
  const hashes = [];
  function source(label, time) {
    const result = fixture(`${prefix}-${label}`, time);
    hashes.push(result.sqlSha256);
    return result;
  }
  async function coreFingerprint() {
    const counts = {};
    for (const [model, key] of Object.entries({ user: "id", project: "id", block: "id", plot: "id", customer: "id", lead: "id", activity: "id", booking: "id", payment: "id", rolePolicy: "role", accessAudit: "id", paymentPlan: "id", installment: "id" })) {
      const rows = await prisma[model].findMany({ orderBy: { [key]: "asc" } });
      counts[model] = { count: rows.length, sha256: crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
    }
    return counts;
  }
  try {
    const before = await coreFingerprint();
    await t.test("apply persists every original string, exact reconciliation and source IDs", async () => {
      const manifest = source("normal");
      const result = await importManifest(prisma, manifest, { apply: true });
      assert.equal(result.status, "imported");
      const rows = await prisma.legacyRecord.findMany({ where: { importId: result.id } });
      assert.equal(rows.length, 7);
      assert.equal(rows.find(row => row.tableName === "sale_daily" && row.sourceId === "1").data.amount, "9007199254740993.01");
      assert.equal(result.reconciliation.tables.sale_daily.sums.amount, "9007199254740993.03");
      assert.equal((await prisma.legacyImport.findUnique({ where: { id: result.id } })).snapshotAt, manifest.snapshotAt);
      const repeat = await importManifest(prisma, manifest, { apply: true });
      assert.equal(repeat.status, "unchanged");
      assert.equal(repeat.id, result.id);
      manifest.sourceFile = "same-dump-repacked.sql";
      manifest.archiveSha256 = null;
      manifest.tables.sale_daily.reverse();
      assert.equal((await importManifest(prisma, manifest, { apply: true })).status, "unchanged");
      assert.equal(await prisma.legacyRecord.count({ where: { importId: result.id } }), 7);
      manifest.tables.sale_daily[0].amount = "999";
      await assert.rejects(importManifest(prisma, manifest, { apply: true }), ManifestError);
      assert.equal(await prisma.legacyRecord.count({ where: { importId: result.id } }), 7);
    });
    await t.test("concurrent imports create exactly one complete snapshot", async () => {
      const manifest = source("concurrent");
      const results = await Promise.all(Array.from({ length: 3 }, () => importManifest(prisma, manifest, { apply: true })));
      assert.equal(results.filter(result => result.status === "imported").length, 1);
      assert.equal(results.filter(result => result.status === "unchanged").length, 2);
      assert.equal(new Set(results.map(result => result.id)).size, 1);
      assert.equal(await prisma.legacyImport.count({ where: { sourceSha256: manifest.sqlSha256 } }), 1);
      assert.equal(await prisma.legacyRecord.count({ where: { importId: results[0].id } }), 7);
    });
    await t.test("older snapshots never replace a newer snapshot", async () => {
      const newer = source("newer", "2026-10-18 05:30:01");
      const older = source("older", "2026-10-12 05:30:01");
      const newerResult = await importManifest(prisma, newer, { apply: true });
      await importManifest(prisma, older, { apply: true });
      const snapshots = await prisma.legacyImport.findMany({ where: { sourceSha256: { in: [newer.sqlSha256, older.sqlSha256] } }, orderBy: { snapshotAt: "desc" } });
      assert.equal(snapshots.length, 2);
      assert.equal(snapshots[0].id, newerResult.id);
      assert.equal(await prisma.legacyRecord.count({ where: { importId: newerResult.id } }), 7);
    });
    await t.test("failure after record insertion rolls back import and all rows", async () => {
      const manifest = source("rollback");
      const beforeRecords = await prisma.legacyRecord.count();
      const injectedClient = {
        $transaction: (callback, options) => prisma.$transaction(tx => callback({
          legacyImport: tx.legacyImport,
          legacyRecord: { createMany: async args => { await tx.legacyRecord.createMany(args); throw new Error("Synthetic rollback injection"); } },
        }), options),
        legacyImport: prisma.legacyImport,
      };
      await assert.rejects(importManifest(injectedClient, manifest, { apply: true }), /Synthetic rollback injection/);
      assert.equal(await prisma.legacyImport.count({ where: { sourceSha256: manifest.sqlSha256 } }), 0);
      assert.equal(await prisma.legacyRecord.count(), beforeRecords);
    });
    await t.test("core CRM records and user credentials remain unchanged", async () => {
      assert.deepEqual(await coreFingerprint(), before);
    });
  } finally {
    await prisma.legacyImport.deleteMany({ where: { sourceSha256: { in: hashes } } });
    await prisma.$disconnect();
  }
});
