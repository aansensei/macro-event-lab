import { describe, expect, it } from "vitest";

import type { Arena, ArenaForecast, CalibrationRow } from "../data/arena";
import type { Revisions } from "../data/types";
import {
  BANNED_COMPARISON_WORDS,
  cpiUncertaintyCard,
  gdpComparisonCard,
  gdpComparisonErrors,
  headlineCards,
  payrollsRevisionCard,
} from "./headlineFindings";

function makeRevisions(n: number, meanAbsRevision: number | null): Revisions {
  return {
    schema_version: 1,
    settled_months: 24,
    series: [{
      series: "payrolls",
      label: "Jobs",
      unit: "jobs",
      resolution: 1000,
      latest_vintage: "2026-10-02",
      n,
      mean_revision: 0,
      mean_abs_revision: meanAbsRevision,
      mean_abs_next: null,
      share_up: null,
      share_down: null,
      mean_abs_first: null,
      biggest: [],
      points: [],
    }],
  };
}

function makeGdpForecast(index: number, actual: number | null, spf: number | null, naive: number | null): ArenaForecast {
  const year = 2000 + Math.floor(index / 4);
  const month = String(1 + (index % 4) * 3).padStart(2, "0");
  return {
    target: "gdp",
    period: `${year}-${month}-01`,
    made_on: `${year}-${month}-15`,
    actual,
    values: { spf, naive },
    intervals: {},
  };
}

function makeArena(forecasts: ArenaForecast[], calibration: CalibrationRow[] = []): Arena {
  return {
    schema_version: 1,
    information_date: "2026-11-24",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Naive", kind: "baseline", note: "Previous print" },
      { id: "spf", label: "Survey median", kind: "human", note: "SPF" },
    ],
    forecasts,
    scores: [],
    leakage: [],
    live: [],
    calibration,
  };
}

describe("payrollsRevisionCard", () => {
  it("converts payrolls mean_abs_revision from jobs to rounded thousands", () => {
    // 73,600 jobs / 1,000 = 73.6 -> rounds to 74 thousand jobs
    const card = payrollsRevisionCard(makeRevisions(25, 73600));
    expect(card).toEqual({
      id: "revisions",
      figure: "74 thousand jobs",
      sentence: "On average a payrolls figure changes by this much between its first publication and today.",
      caveat: "Across 25 months.",
      page: "revisions",
    });
  });

  it("returns null when revisions are missing, null or have fewer than 20 observations", () => {
    expect(payrollsRevisionCard(null)).toBeNull();
    expect(payrollsRevisionCard(makeRevisions(19, 73600))).toBeNull();
    expect(payrollsRevisionCard(makeRevisions(20, null))).toBeNull();
    expect(payrollsRevisionCard(makeRevisions(20, 73600))).not.toBeNull();
  });
});

describe("gdpComparisonCard", () => {
  it("computes same-period RMSE for survey and naive over rows where both and actual exist", () => {
    // 20 common quarters:
    // 10 rows with actual - spf = 1 (sq = 1) and 10 rows with actual - spf = 3 (sq = 9): mean = 5, sqrt(5) = 2.2360679 -> 2.2
    // 10 rows with actual - naive = 4 (sq = 16) and 10 rows with actual - naive = 6 (sq = 36): mean = 26, sqrt(26) = 5.0990195 -> 5.1
    const common = Array.from({ length: 20 }, (_, i) =>
      i < 10 ? makeGdpForecast(i, 10, 9, 6) : makeGdpForecast(i, 10, 7, 4),
    );
    // extra rows that must be excluded: missing spf, missing actual, non-gdp target
    const extras: ArenaForecast[] = [
      makeGdpForecast(30, 10, null, 0),
      makeGdpForecast(31, null, 2, 2),
      { target: "cpi", period: "2020-01-01", made_on: "2020-01-15", actual: 5, values: { spf: 0, naive: 0 }, intervals: {} },
    ];
    const arena = makeArena([...common, ...extras]);
    const stats = gdpComparisonErrors(arena);
    expect(stats?.n).toBe(20);
    expect(stats?.spfRmse).toBeCloseTo(Math.sqrt(5), 10);
    expect(stats?.naiveRmse).toBeCloseTo(Math.sqrt(26), 10);

    const card = gdpComparisonCard(arena);
    expect(card).toEqual({
      id: "gdp-comparison",
      figure: "2.2 and 5.1 points",
      sentence: "On GDP growth, over the same quarters, here is how far the survey and the naive forecast were from the first published number.",
      caveat: "Across 20 quarters, preliminary results.",
      page: "arena",
    });
  });

  it("returns null when fewer than 20 common GDP quarters exist", () => {
    const nineteen = Array.from({ length: 19 }, (_, i) => makeGdpForecast(i, 2, 1.5, 1));
    expect(gdpComparisonCard(null)).toBeNull();
    expect(gdpComparisonCard(makeArena(nineteen))).toBeNull();
  });

  it("never contains banned comparison words in any text field", () => {
    const rows = Array.from({ length: 22 }, (_, i) => makeGdpForecast(i, 3, 2, 1));
    const card = gdpComparisonCard(makeArena(rows))!;
    const allText = `${card.figure} ${card.sentence} ${card.caveat}`;
    for (const word of BANNED_COMPARISON_WORDS) {
      expect(allText).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
    }
  });
});

describe("cpiUncertaintyCard", () => {
  it("reads the 90 percent naive CPI calibration share as a whole percent", () => {
    // 0.884 * 100 = 88.4 -> rounds to 88%
    const arena = makeArena([], [
      { target: "cpi", contestant: "naive", level: 0.5, n: 40, coverage: 0.55, coverage_lo: 0.4, coverage_hi: 0.7 },
      { target: "cpi", contestant: "naive", level: 0.9, n: 25, coverage: 0.884, coverage_lo: 0.7, coverage_hi: 0.96 },
      { target: "gdp", contestant: "naive", level: 0.9, n: 25, coverage: 0.92, coverage_lo: 0.75, coverage_hi: 0.98 },
    ]);
    expect(cpiUncertaintyCard(arena)).toEqual({
      id: "uncertainty",
      figure: "88%",
      sentence: "A forecast range that promises 90 percent held the real inflation number about this often.",
      caveat: "Across 25 releases.",
      page: "arena",
    });
  });

  it("returns null when calibration is missing or has fewer than 20 releases", () => {
    expect(cpiUncertaintyCard(null)).toBeNull();
    expect(cpiUncertaintyCard(makeArena([], []))).toBeNull();
    expect(cpiUncertaintyCard(makeArena([], [
      { target: "cpi", contestant: "naive", level: 0.9, n: 19, coverage: 0.9, coverage_lo: 0.7, coverage_hi: 0.98 },
    ]))).toBeNull();
  });
});

describe("headlineCards", () => {
  it("keeps only cards with at least 20 observations and returns empty when none qualify", () => {
    const thinArena = makeArena([], [
      { target: "cpi", contestant: "naive", level: 0.9, n: 20, coverage: 0.902, coverage_lo: 0.7, coverage_hi: 0.98 },
    ]);
    const cards = headlineCards(thinArena, makeRevisions(10, 50000));
    expect(cards.map((c) => c.id)).toEqual(["uncertainty"]);
    expect(headlineCards(null, null)).toEqual([]);
  });
});
