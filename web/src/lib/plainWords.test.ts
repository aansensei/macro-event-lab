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
    expect(yields).toContain("about 6.1 bp in the same direction, so this surprise pointed to about +1 bp");
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
    expect(yields).toContain("surprises have barely moved yields on the day");
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

  it("phrases the Fed decision as the top of the rate range", () => {
    const fed: EventFile = { ...cpi, series: "KXFED", unit: "% upper bound", first_print: 3.75, surprise_sd: 0 };
    expect(plainWords(fed, "published", 3.75)[0]).toContain(
      "the Fed to set the top of its interest rate range at 3.75%",
    );
  });
});
