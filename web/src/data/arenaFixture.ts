import type { Arena } from "./arena";

export const arenaFixture: Arena = {
  schema_version: 1, information_date: "2026-11-20",
  targets: [
    { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
    { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
    { id: "payrolls", label: "Payrolls", unit: "thousands of jobs", frequency: "monthly" },
  ],
  contestants: [
    { id: "naive", label: "Fixture A", kind: "baseline", note: "Synthetic baseline." },
    { id: "fixture-b", label: "Fixture B", kind: "classical", note: "Synthetic forecast." },
    { id: "fixture-c", label: "Fixture C", kind: "foundation", note: "Synthetic cutoff." },
  ],
  forecasts: [
    { target: "gdp", period: "2025-01-01", made_on: "2025-02-15", actual: 0,
      values: { naive: 1, "fixture-b": 0.5, "fixture-c": null },
      intervals: { naive: { level: 0.9, lo: 0, hi: 2 }, "fixture-b": null } },
    { target: "gdp", period: "2025-04-01", made_on: "2025-05-15", actual: 2,
      values: { naive: 0, "fixture-b": 1.5, "fixture-c": null },
      intervals: { naive: { level: 0.9, lo: -1, hi: 1 }, "fixture-b": { level: 0.9, lo: 1, hi: 2 } } },
  ],
  scores: [
    { target: "gdp", contestant: "naive", window: "all", n: 2, mae: 1.5, rmse: Math.sqrt(2.5), coverage_90: 0.5, dm_vs_naive_p: null },
    { target: "gdp", contestant: "fixture-b", window: "all", n: 2, mae: 0.5, rmse: 0.5, coverage_90: 1, dm_vs_naive_p: null },
    { target: "gdp", contestant: "fixture-c", window: "all", n: 0, mae: null, rmse: null, coverage_90: null, dm_vs_naive_p: null },
  ],
  leakage: [{ contestant: "fixture-c", cutoff_rule: "weights_release_date", cutoff: "2025-01-01",
    n_before: 0, n_after: 0, rmse_before: null, rmse_after: null }],
  live: [],
};
