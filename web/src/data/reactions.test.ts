import { describe, expect, it, vi } from "vitest";

import { loadReactions, parseReactions, REACTIONS_NOT_BUILT } from "./reactions";

const VALID = {
  schema_version: 1,
  rows: [
    {
      target: "gdp",
      period: "2025-01-01",
      release_date: "2025-04-30",
      first_print: 2.4,
      benchmark: 2.1,
      benchmark_kind: "survey",
      surprise: 0.3,
      d2y_bp: 4.0,
      d10y_bp: 2.0,
    },
  ],
  summary: [
    {
      target: "gdp",
      n: 1,
      corr_2y: null,
      corr_10y: null,
      slope_10y_bp_per_unit: null,
      p_10y: null,
    },
    {
      target: "cpi",
      n: 0,
      corr_2y: null,
      corr_10y: null,
      slope_10y_bp_per_unit: null,
      p_10y: null,
    },
    {
      target: "payrolls",
      n: 0,
      corr_2y: null,
      corr_10y: null,
      slope_10y_bp_per_unit: null,
      p_10y: null,
    },
  ],
  units: {
    gdp: "annualized percent q/q",
    cpi: "percent m/m",
    payrolls: "thousands of jobs",
  },
};

describe("reactions loader", () => {
  it("parses valid reactions payloads", () => {
    const parsed = parseReactions(VALID);
    expect(parsed.schema_version).toBe(1);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.benchmark_kind).toBe("survey");
    expect(parsed.units.gdp).toBe("annualized percent q/q");
  });

  it("rejects unsupported versions and malformed values", () => {
    expect(() => parseReactions({ ...VALID, schema_version: 2 })).toThrow("Unsupported reactions data version");
    expect(() => parseReactions({
      ...VALID,
      rows: [{ ...VALID.rows[0], benchmark_kind: "market" }],
    })).toThrow("survey or models");
    expect(() => parseReactions({
      ...VALID,
      summary: [{ target: "gdp", n: 10, corr_2y: 1.5, corr_10y: 0.2, slope_10y_bp_per_unit: 1.0, p_10y: 0.1 }],
    })).toThrow("invalid numeric value");
    expect(() => parseReactions({
      ...VALID,
      rows: [{ ...VALID.rows[0], release_date: "2025-02-30" }],
    })).toThrow("real calendar date");
  });

  it("maps 404 to the not built message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(loadReactions(fetchMock as unknown as typeof fetch)).rejects.toThrow(REACTIONS_NOT_BUILT);
  });
});
