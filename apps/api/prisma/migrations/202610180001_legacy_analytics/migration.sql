-- Preserve legacy analytics as immutable import snapshots, separate from CRM transactions.
CREATE TABLE "LegacyImport" (
  "id" TEXT NOT NULL,
  "sourceDatabase" TEXT NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "sourceSha256" TEXT NOT NULL,
  "archiveSha256" TEXT,
  "snapshotAt" TEXT NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recordCount" INTEGER NOT NULL,
  "sourceCounts" JSONB NOT NULL,
  "reconciliation" JSONB NOT NULL,
  CONSTRAINT "LegacyImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyRecord" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "LegacyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegacyImport_sourceSha256_key" ON "LegacyImport"("sourceSha256");
CREATE INDEX "LegacyImport_snapshotAt_idx" ON "LegacyImport"("snapshotAt");
CREATE UNIQUE INDEX "LegacyRecord_importId_tableName_sourceId_key" ON "LegacyRecord"("importId", "tableName", "sourceId");
CREATE INDEX "LegacyRecord_importId_tableName_idx" ON "LegacyRecord"("importId", "tableName");
ALTER TABLE "LegacyRecord" ADD CONSTRAINT "LegacyRecord_importId_fkey" FOREIGN KEY ("importId") REFERENCES "LegacyImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
