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
    { target: "gdp", contestant: "naive", window: "all", n: 2, mae: 1.5, rmse: Math.sqrt(2.5), coverage_90: 0.5, dm_vs_naive_p: null,
      n_intervals: 2, coverage_90_lo: 0.0945, coverage_90_hi: 0.9055, pinball_05: 0.15, pinball_50: 0.75, pinball_95: 0.25, aci_n: 2, aci_coverage_90: 0.5 },
    { target: "gdp", contestant: "fixture-b", window: "all", n: 2, mae: 0.5, rmse: 0.5, coverage_90: 1, dm_vs_naive_p: null,
      n_intervals: 1, coverage_90_lo: 0.2065, coverage_90_hi: 1, pinball_05: 0.05, pinball_50: 0.25, pinball_95: 0.15, aci_n: 1, aci_coverage_90: 1 },
    { target: "gdp", contestant: "fixture-c", window: "all", n: 0, mae: null, rmse: null, coverage_90: null, dm_vs_naive_p: null,
      n_intervals: 0, coverage_90_lo: null, coverage_90_hi: null, pinball_05: null, pinball_50: null, pinball_95: null, aci_n: 0, aci_coverage_90: null },
  ],
  leakage: [{ contestant: "fixture-c", cutoff_rule: "weights_release_date", cutoff: "2025-01-01",
    n_before: 0, n_after: 0, rmse_before: null, rmse_after: null }],
  live: [],
  nested_tests: [
    { target: "gdp", restricted: "naive", larger: "fixture-b", window: "all", n: 2, statistic: 1.45, p_value: 0.142 },
    { target: "gdp", restricted: "fixture-b", larger: "fixture-c", window: "all", n: 2, statistic: -0.35, p_value: 0.618 },
  ],
};
