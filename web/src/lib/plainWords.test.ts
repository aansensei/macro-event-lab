import { describe, expect, it } from "vitest";

import type { EventFile, Insight } from "../data/types";
import { MINUS } from "./format";
import { closeness, plainWords } from "./plainWords";

const insight: Insight = {
  in_50: true, in_90: true, surprise_rank_pct: 0.28, series_n: 58,
  series_hit_50: 0.53, series_hit_90: 0.88, yield_n: 57,
  dgs2_bp_per_sd: 6.06, dgs10_bp_per_sd: 4.12, dgs2_corr: 0.55, dgs10_corr: 0.48,
};

const cpi: EventFile = {
  schema_version: 1, id: "kxcpi-26sep", event_ticker: "KXCPI-26SEP", series: "KXCPI",
  title: "CPI, September 2026", unit: "% m/m", resolution: 0.1, close: "2026-10-14T12:29:00Z",
  release_date: "2026-10-14", reference_period: "2026-09-01", first_print: 0.6,
  first_print_source: "alfred", match_method: "reference_period", settled_value: 0.6,
  surprise: 0.03, surprise_sd: 0.24,
  reaction: { date: "2026-10-14", prev_date: "2026-10-13", dgs2_bp: 3, dgs10_bp: -2 },
  insight, snapshots: [],
};

describe("closeness", () => {
  it("puts the surprise into words by size and side", () => {
    expect(closeness(0.24)).toBe("very close to what traders expected");
    expect(closeness(-0.7)).toBe("a little below what traders expected");
    expect(closeness(1.4)).toBe("clearly above what traders expected");
    expect(closeness(-2.2)).toBe("far below what traders expected, a big surprise");
  });
});

describe("plainWords", () => {
  it("uses only selected-snapshot expectations before reveal and hides daily yields at the first-print step", () => {
    const hidden = plainWords(cpi, "published", 0.1, null, 0).join(" ");
    expect(hidden).toContain("selected market snapshot");
    expect(hidden).toContain("rise 0.1%");
    expect(hidden).not.toContain("0.6%");
    expect(hidden).not.toContain("28%");
    expect(hidden).not.toContain("3 bp");
    expect(plainWords(cpi, "published", 0.1, null, 1).join(" ")).not.toContain("On release day");
    expect(plainWords(cpi, "published", null, [[0.2, 0.25, 0.3]], 0)[0]).toContain("30%");
    expect(plainWords(cpi, "published", null, [], 0)[0]).toContain("no estimate");
  });
  it("explains a published CPI release with its context and the yield move", () => {
    const [first, context, yields] = plainWords(cpi, "published", 0.58);
    expect(first).toBe(
      "Just before the release, traders expected consumer prices to rise 0.6% in one month. " +
        "The official number came in at 0.6%, very close to what traders expected.",
    );
    expect(context).toContain("bigger than 28% of the other 57 CPI reports");
    expect(context).toContain("inside the market's middle range");
    expect(context).toContain("90% range 88% of the time");
    expect(yields).toContain("the 2-year Treasury yield rose 3 bp and the 10-year fell 2 bp");
    expect(yields).toContain("about 6.1 bp in the same direction; the fitted relationship gives about +1 bp");
    expect(yields).toContain("A rising 2-year yield usually means");
  });

  it("explains a falling yield as expected rate cuts", () => {
    const fell = { ...cpi, reaction: { date: "2026-10-14", prev_date: "2026-10-13", dgs2_bp: -6, dgs10_bp: -4 } };
    const yields = plainWords(fell, "published", 0.58)[2];
    expect(yields).toContain("the 2-year Treasury yield fell 6 bp");
    expect(yields).toContain("A falling 2-year yield usually means markets expect interest rates to come down sooner.");
  });

  it("speaks of jobs in whole numbers and flags a miss outside the 90% range", () => {
    const jobs: EventFile = {
      ...cpi, series: "KXPAYROLLS", unit: "jobs", first_print: -23000, surprise_sd: -2.15,
      insight: { ...insight, in_50: false, in_90: false, dgs2_corr: 0.1 },
    };
    const [first, context, yields] = plainWords(jobs, "published", 88500);
    expect(first).toContain("the economy to add about 89,000 jobs in one month");
    expect(first).toContain(`came in at ${MINUS}23,000 jobs, far below what traders expected, a big surprise`);
    expect(context).toContain("outside the range the market saw as 90% likely");
    expect(yields).toContain("the linear association between surprises and daily yield changes is weak");
  });

  it("describes an upcoming release by the current expectation only", () => {
    expect(plainWords({ ...cpi, first_print: null }, "upcoming", 0.3)).toEqual([
      "This number is not out yet. Right now, traders expect consumer prices to rise 0.3% in one month.",
    ]);
  });

  it("says there is nothing to compare for a release never published", () => {
    const [only] = plainWords({ ...cpi, first_print: null, surprise_sd: null }, "not_published", null);
    expect(only).toBe("This report has no published number in this data, so there is nothing to compare with.");
  });

  it("reads a release with only one contract as a single bet", () => {
    const early: EventFile = { ...cpi, surprise_sd: null, surprise: null, first_print: 0.5, insight: null, reaction: null };
    const [only] = plainWords(early, "published", null, [[0.7, 0.1, 0.12]]);
    expect(only).toBe(
      "Kalshi listed only one contract for this release: whether monthly CPI would come in above 0.7%. " +
        "Just before trading closed, traders put that at 12%. The official number came in at 0.5%, " +
        "so the contract paid no and the market had leaned the right way. With a single contract there " +
        "is no full set of odds, so there is no median or surprise to measure.",
    );
  });

  it("says when a single contract went against the market", () => {
    const early: EventFile = { ...cpi, surprise_sd: null, surprise: null, first_print: 0.9, insight: null, reaction: null };
    const [only] = plainWords(early, "published", null, [[0.7, 0.2, 0.2]]);
    expect(only).toContain("so the contract paid yes, against the market's lean");
  });

  it("phrases the Fed decision as the top of the rate range", () => {
    const fed: EventFile = { ...cpi, series: "KXFED", unit: "% upper bound", first_print: 3.75, surprise_sd: 0 };
    expect(plainWords(fed, "published", 3.75)[0]).toContain(
      "the Fed to set the top of its interest rate range at 3.75%",
    );
  });
});
