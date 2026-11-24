"use strict";
const { createHash } = require("node:crypto");
function fixture(label = "synthetic", snapshotAt = "2026-10-18 05:30:01") {
  const tables = {
    company: [{ id: 1, name: "Synthetic migration fixture", biznet_id: null, legacy_id: null, biznet_start: "2025-01-01" }],
    sale_daily: [
      { id: 1, company_id: 1, date: "2026-10-01", amount: "9007199254740993.01", due: "0.1", od: "-0.1", cod_od: "0" },
      { id: 2, company_id: 1, date: "2026-10-02", amount: "0.02", due: "0.2", od: "0.2", cod_od: "1.001" },
    ],
    sale_monthly: [{ id: 1, company_id: 1, month: 10, year: 2026, amount: "0.3", due: "5", od: "0", cod_od: "0" }],
    target_daily: [{ id: 1, company_id: 1, date: "2026-10-01", amount: "20" }],
    target_monthly: [{ id: 1, company_id: 1, month: 10, year: 2026, amount: "100" }],
    target_yearly: [{ id: 1, company_id: 1, year: "2026-2027", amount: "1200" }],
  };
  return {
    formatVersion: 1,
    sourceDatabase: "bridge_analytics_prod",
    sourceFile: "synthetic.sql.tar.xz",
    sqlSha256: createHash("sha256").update(label).digest("hex"),
    archiveSha256: createHash("sha256").update(`${label}.archive`).digest("hex"),
    snapshotAt,
    sourceCounts: { ...Object.fromEntries(Object.entries(tables).map(([key, value]) => [key, value.length])), eit_system: 0, pnl: 0, user: 2, user_key: 1 },
    tables,
  };
}
module.exports = { fixture };
