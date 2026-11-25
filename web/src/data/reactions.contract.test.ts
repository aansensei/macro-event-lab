import { describe, expect, it, vi } from "vitest";

import { loadReactions, parseReactions } from "./reactions";

function samplePayload(): Record<string, unknown> {
  return {
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
        d2y_bp: 5.0,
        d10y_bp: -2.0,
      },
      {
        target: "cpi",
        period: "2025-02-01",
        release_date: "2025-03-12",
        first_print: 0.2,
        benchmark: 0.3,
        benchmark_kind: "models",
        surprise: -0.1,
        d2y_bp: -4.0,
        d10y_bp: -3.0,
      },
    ],
    summary: [
      { target: "gdp", n: 10, corr_2y: 0.4, corr_10y: 0.35, slope_10y_bp_per_unit: 2.5, p_10y: 0.0 },
      { target: "cpi", n: 4, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
      { target: "payrolls", n: 0, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
    ],
    units: {
      gdp: "annualized percent q/q",
      cpi: "percent m/m",
      payrolls: "thousands of jobs",
    },
  };
}

describe("parseReactions contract", () => {
  it("accepts a valid payload with populated and thin summaries", () => {
    const parsed = parseReactions(samplePayload());
    expect(parsed.schema_version).toBe(1);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.summary).toHaveLength(3);
    expect(parsed.units.payrolls).toBe("thousands of jobs");
  });

  it("accepts an empty rows list with zero-count null summaries", () => {
    const raw = samplePayload();
    raw.rows = [];
    raw.summary = [
      { target: "gdp", n: 0, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
      { target: "cpi", n: 0, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
      { target: "payrolls", n: 0, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
    ];
    const parsed = parseReactions(raw);
    expect(parsed.rows).toEqual([]);
  });

  it("rejects non-object roots and unsupported schema versions", () => {
    expect(() => parseReactions(null)).toThrow();
    expect(() => parseReactions([])).toThrow();
    expect(() => parseReactions({ ...samplePayload(), schema_version: 2 })).toThrow(/version/i);
    expect(() => parseReactions({ ...samplePayload(), schema_version: "1" })).toThrow();
  });

  it("rejects unknown targets, invalid dates and invalid benchmark kinds", () => {
    const badTarget = samplePayload();
    (badTarget.rows as Record<string, unknown>[])[0]!.target = "fed";
    expect(() => parseReactions(badTarget)).toThrow();

    const badDate = samplePayload();
    (badDate.rows as Record<string, unknown>[])[0]!.release_date = "2025-02-30";
    expect(() => parseReactions(badDate)).toThrow();

    const badKind = samplePayload();
    (badKind.rows as Record<string, unknown>[])[0]!.benchmark_kind = "market";
    expect(() => parseReactions(badKind)).toThrow();
  });

  it("rejects malformed numeric fields and invalid summary counts", () => {
    const badSurprise = samplePayload();
    (badSurprise.rows as Record<string, unknown>[])[0]!.surprise = "0.3";
    expect(() => parseReactions(badSurprise)).toThrow();

    const badYield = samplePayload();
    (badYield.rows as Record<string, unknown>[])[0]!.d10y_bp = null;
    expect(() => parseReactions(badYield)).toThrow();

    const badCount = samplePayload();
    (badCount.summary as Record<string, unknown>[])[0]!.n = -1;
    expect(() => parseReactions(badCount)).toThrow();

    const fractionalCount = samplePayload();
    (fractionalCount.summary as Record<string, unknown>[])[0]!.n = 2.5;
    expect(() => parseReactions(fractionalCount)).toThrow();
  });
});

describe("loadReactions contract", () => {
  it("loads and parses valid JSON on HTTP 200", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify(samplePayload()), { status: 200 }),
    );
    const data = await loadReactions(mockFetch);
    expect(data.schema_version).toBe(1);
    expect(data.rows).toHaveLength(2);
  });

  it("reports not built yet on HTTP 404", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, { status: 404 }),
    );
    await expect(loadReactions(mockFetch)).rejects.toThrow(/not.*built/i);
  });

  it("throws a plain message on server errors and invalid JSON", async () => {
    const serverErrorFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );
    await expect(loadReactions(serverErrorFetch)).rejects.toThrow(/500|failed/i);

    const badJsonFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response("not-json", { status: 200 }),
    );
    await expect(loadReactions(badJsonFetch)).rejects.toThrow(/json/i);
  });
});
