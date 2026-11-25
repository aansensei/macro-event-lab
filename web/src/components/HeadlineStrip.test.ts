import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Arena, ArenaForecast } from "../data/arena";
import type { Revisions } from "../data/types";
import { BANNED_COMPARISON_WORDS } from "../lib/headlineFindings";
import { HeadlineStrip } from "./HeadlineStrip";

function gdpRow(index: number, actual: number, spf: number, naive: number): ArenaForecast {
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

const FULL_REVISIONS = {
  schema_version: 1,
  settled_months: 24,
  series: [{
    series: "payrolls",
    label: "Jobs",
    unit: "jobs",
    resolution: 1000,
    latest_vintage: "2026-10-02",
    n: 30,
    mean_abs_revision: 45400,
  }],
} as unknown as Revisions;

const FULL_ARENA: Arena = {
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
  forecasts: Array.from({ length: 20 }, (_, i) => gdpRow(i, 4, 3, 1)),
  scores: [],
  leakage: [],
  live: [],
  calibration: [
    { target: "cpi", contestant: "naive", level: 0.9, n: 40, coverage: 0.896, coverage_lo: 0.76, coverage_hi: 0.96 },
  ],
};

describe("HeadlineStrip", () => {
  it("renders three cards with mono figures, plain sentences, caveats and evidence links", () => {
    const html = renderToStaticMarkup(createElement(HeadlineStrip, { arena: FULL_ARENA, revisions: FULL_REVISIONS }));
    expect(html).toContain('class="headline-figure mono num"');
    expect(html).toContain("45 thousand jobs");
    expect(html).toContain("On average a payrolls figure changes by this much between its first publication and today.");
    expect(html).toContain("Across 30 months.");
    expect(html).toContain("1.0 and 3.0 points");
    expect(html).toContain("On GDP growth, over the same quarters, here is how far the survey and the naive forecast were from the first published number.");
    expect(html).toContain("Across 20 quarters, preliminary results.");
    expect(html).toContain("90%");
    expect(html).toContain("A forecast range that promises 90 percent held the real inflation number about this often.");
    expect(html).toContain("Across 40 releases.");
    expect(html).toContain('href="?page=revisions"');
    expect(html).toContain('href="?page=arena"');
    expect(html.match(/See the evidence/g)).toHaveLength(3);
  });

  it("renders nothing when all cards are missing or have fewer than 20 observations", () => {
    expect(renderToStaticMarkup(createElement(HeadlineStrip, { arena: null, revisions: null }))).toBe("");
    const thinRevisions = {
      ...FULL_REVISIONS,
      series: [{ ...FULL_REVISIONS.series[0], n: 19 }],
    } as unknown as Revisions;
    const thinArena: Arena = {
      ...FULL_ARENA,
      forecasts: FULL_ARENA.forecasts.slice(0, 19),
      calibration: [{ target: "cpi", contestant: "naive", level: 0.9, n: 19, coverage: 0.9, coverage_lo: 0.7, coverage_hi: 0.98 }],
    };
    expect(renderToStaticMarkup(createElement(HeadlineStrip, { arena: thinArena, revisions: thinRevisions }))).toBe("");
  });

  it("never uses banned comparison words in any rendered state", () => {
    const states: [Arena | null, Revisions | null][] = [
      [FULL_ARENA, FULL_REVISIONS],
      [FULL_ARENA, null],
      [null, FULL_REVISIONS],
      [{ ...FULL_ARENA, calibration: [] }, null],
    ];
    for (const [arena, revisions] of states) {
      const html = renderToStaticMarkup(createElement(HeadlineStrip, { arena, revisions }));
      const text = html.replace(/<[^>]+>/g, " ");
      for (const word of BANNED_COMPARISON_WORDS) {
        expect(text).not.toMatch(new RegExp(`\\b${word}\\b`, "i"));
      }
    }
  });
});
