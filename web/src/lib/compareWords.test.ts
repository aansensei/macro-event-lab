import { describe, expect, it } from "vitest";

import type { SeriesSummary } from "../data/types";
import { seriesFinding, verdict } from "./compareWords";

const cpi: SeriesSummary = {
  series: "KXCPI", label: "CPI", n: 58, yield_n: 58, hit_50: 0.534, hit_90: 0.879,
  dgs2_bp_per_sd: 6.06, dgs10_bp_per_sd: 4.12, dgs2_corr: 0.551, dgs10_corr: 0.479, mean_abs_sd: 0.69,
  scores: null,
};

describe("verdict", () => {
  it("reads the real series the way the data shows", () => {
    expect(verdict(cpi)).toBe("calibrated");
    expect(verdict({ ...cpi, series: "KXPAYROLLS", hit_50: 0.395, hit_90: 0.86 })).toBe("overconfident");
    expect(verdict({ ...cpi, hit_50: 0.7, hit_90: 0.97 })).toBe("cautious");
    expect(verdict({ ...cpi, series: "KXFED", hit_50: 0.97, hit_90: 1, mean_abs_sd: 0.076 })).toBe("priced-in");
    expect(verdict({ ...cpi, hit_50: null })).toBe("unknown");
  });
});

describe("seriesFinding", () => {
  it("states calibration, the typical miss and the yield response for CPI", () => {
    expect(seriesFinding(cpi)).toBe(
      "Across 58 CPI releases, markets were well calibrated: the official number fell inside the market's 90% range 88% of the time and its 50% range 53%, against ideals of 90% and 50%. " +
        "The typical miss was 0.7 SD. " +
        "A 1 SD surprise moved the 2-year Treasury yield about 6.1 bp in the same direction on the day (correlation 0.55).",
    );
  });

  it("says when surprises barely moved yields", () => {
    const gdp = { ...cpi, series: "KXGDP", label: "GDP", hit_50: 0.42, hit_90: 0.79, dgs2_corr: 0.04, dgs2_bp_per_sd: 0.26 };
    const text = seriesFinding(gdp);
    expect(text).toContain("a little overconfident");
    expect(text).toContain("Surprises barely moved the 2-year Treasury yield on the day (correlation 0.04).");
  });

  it("explains that Fed decisions are priced in", () => {
    const fed = { ...cpi, series: "KXFED", label: "FOMC", n: 37, mean_abs_sd: 0.076 };
    expect(seriesFinding(fed)).toContain("across 37 meetings the average miss was just 0.08 SD");
  });
});
