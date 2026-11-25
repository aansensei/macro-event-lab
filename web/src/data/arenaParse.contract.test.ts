import { describe, expect, it, vi } from "vitest";

import { loadArena, parseArena } from "./arena";

function baseRawArena(): Record<string, unknown> {
  return {
    schema_version: 1,
    information_date: "2026-11-20",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Naive", kind: "baseline", note: "Last observation." },
      { id: "ar", label: "Autoregression", kind: "classical", note: "AR model." },
      { id: "ridge", label: "Ridge", kind: "classical", note: "Ridge model." },
    ],
    forecasts: [],
    scores: [
      {
        target: "gdp",
        contestant: "naive",
        window: "all",
        n: 40,
        mae: 0.8,
        rmse: 1.1,
        coverage_90: 0.85,
        dm_vs_naive_p: null,
      },
      {
        target: "gdp",
        contestant: "ar",
        window: "all",
        n: 40,
        mae: 0.7,
        rmse: 0.95,
        coverage_90: 0.875,
        dm_vs_naive_p: 0.12,
      },
    ],
    leakage: [],
    live: [],
  };
}

describe("parseArena contract for new score fields and nested tests", () => {
  it("accepts files without the new fields and defaults missing fields to null and empty list", () => {
    const parsed = parseArena(baseRawArena()) as unknown as {
      scores: Record<string, unknown>[];
      nested_tests: unknown;
    };
    expect(parsed.nested_tests).toEqual([]);
    for (const row of parsed.scores) {
      expect(row.n_intervals).toBeNull();
      expect(row.coverage_90_lo).toBeNull();
      expect(row.coverage_90_hi).toBeNull();
      expect(row.pinball_05).toBeNull();
      expect(row.pinball_50).toBeNull();
      expect(row.pinball_95).toBeNull();
      expect(row.aci_n).toBeNull();
      expect(row.aci_coverage_90).toBeNull();
    }
  });

  it("preserves valid new score fields including zeros and explicit nulls", () => {
    const raw = baseRawArena();
    const scores = raw.scores as Record<string, unknown>[];
    scores[0] = {
      ...scores[0],
      n_intervals: 40,
      coverage_90_lo: 0.7385,
      coverage_90_hi: 0.9465,
      pinball_05: 0.1234,
      pinball_50: 0.3456,
      pinball_95: 0.1789,
      aci_n: 0,
      aci_coverage_90: null,
    };
    scores[1] = {
      ...scores[1],
      n_intervals: 0,
      coverage_90_lo: null,
      coverage_90_hi: null,
      pinball_05: 0,
      pinball_50: 0,
      pinball_95: 0,
      aci_n: 12,
      aci_coverage_90: 0.9167,
    };

    const parsed = parseArena(raw) as unknown as { scores: Record<string, unknown>[] };
    expect(parsed.scores[0]).toMatchObject({
      n_intervals: 40,
      coverage_90_lo: 0.7385,
      coverage_90_hi: 0.9465,
      pinball_05: 0.1234,
      pinball_50: 0.3456,
      pinball_95: 0.1789,
      aci_n: 0,
      aci_coverage_90: null,
    });
    expect(parsed.scores[1]).toMatchObject({
      n_intervals: 0,
      coverage_90_lo: null,
      coverage_90_hi: null,
      pinball_05: 0,
      pinball_50: 0,
      pinball_95: 0,
      aci_n: 12,
      aci_coverage_90: 0.9167,
    });
  });

  it("parses valid nested_tests entries including negative test statistics", () => {
    const raw = baseRawArena();
    const nested = [
      { target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 40, statistic: 2.1543, p_value: 0.0187 },
      { target: "gdp", restricted: "ar", larger: "ridge", window: "clean", n: 12, statistic: -0.4512, p_value: 0.6721 },
    ];
    raw.nested_tests = nested;

    const parsed = parseArena(raw) as unknown as { nested_tests: unknown };
    expect(parsed.nested_tests).toEqual(nested);
  });

  it.each([
    ["n_intervals", -1],
    ["n_intervals", 1.5],
    ["n_intervals", "40"],
    ["n_intervals", NaN],
    ["n_intervals", Infinity],
    ["aci_n", -1],
    ["aci_n", 2.25],
    ["aci_n", "12"],
    ["aci_n", {}],
    ["coverage_90_lo", "0.5"],
    ["coverage_90_lo", NaN],
    ["coverage_90_lo", Infinity],
    ["coverage_90_hi", "0.9"],
    ["coverage_90_hi", true],
    ["pinball_05", "0.1"],
    ["pinball_05", NaN],
    ["pinball_50", Infinity],
    ["pinball_95", -Infinity],
    ["aci_coverage_90", "0.8"],
    ["aci_coverage_90", {}],
  ])("rejects invalid score field %s (%#)", (field, badValue) => {
    const raw = baseRawArena();
    const scores = raw.scores as Record<string, unknown>[];
    scores[0] = { ...scores[0], [field]: badValue };
    expect(() => parseArena(raw)).toThrow();
  });

  it.each([
    null,
    "none",
    {},
    [null],
    [{ target: "payrolls", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "missing", larger: "ar", window: "all", n: 10, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "missing", window: "all", n: 10, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "recent", n: 10, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: -1, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 2.5, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: "10", statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: null, statistic: 1.0, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: NaN, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: Infinity, p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: "1.0", p_value: 0.16 }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: 1.0, p_value: "0.16" }],
    [{ target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 10, statistic: 1.0, p_value: NaN }],
  ])("rejects malformed nested_tests %#", (badNested) => {
    const raw = baseRawArena();
    raw.nested_tests = badNested;
    expect(() => parseArena(raw)).toThrow();
  });

  it("loads arena payloads with and without the new fields via loadArena", async () => {
    const legacyFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(baseRawArena())));
    const legacy = await loadArena(legacyFetch) as unknown as {
      scores: Record<string, unknown>[];
      nested_tests: unknown;
    };
    expect(legacy.nested_tests).toEqual([]);
    expect(legacy.scores[0]?.pinball_05).toBeNull();

    const richRaw = baseRawArena();
    (richRaw.scores as Record<string, unknown>[])[0] = {
      ...(richRaw.scores as Record<string, unknown>[])[0],
      n_intervals: 40,
      coverage_90_lo: 0.78,
      coverage_90_hi: 0.94,
      pinball_05: 0.11,
      pinball_50: 0.33,
      pinball_95: 0.19,
      aci_n: 20,
      aci_coverage_90: 0.9,
    };
    richRaw.nested_tests = [
      { target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 40, statistic: 2.0, p_value: 0.026 },
    ];
    const richFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(richRaw)));
    const rich = await loadArena(richFetch) as unknown as {
      scores: Record<string, unknown>[];
      nested_tests: unknown[];
    };
    expect(rich.scores[0]?.pinball_50).toBe(0.33);
    expect(rich.nested_tests).toHaveLength(1);
  });
});
