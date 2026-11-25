import { describe, expect, it } from "vitest";

import { ODDS_PROBS, oddsLabel, probabilityAbove, thresholdsFor } from "./odds";

// quantiles of a distribution spread evenly from 0 (probability 0.05) to 90 (probability 0.95)
const QUANTILES = Array.from({ length: 19 }, (_, i) => i * 5);

describe("probabilityAbove", () => {
  it("reads the chance from the quantiles by linear interpolation", () => {
    // 45 is the median of 0 to 90, so half the distribution lies above it
    expect(probabilityAbove(QUANTILES, 45).bound).toBe("exact");
    expect(probabilityAbove(QUANTILES, 45).value).toBeCloseTo(0.5, 10);
    // 2.5 lies half way between the 5 percent and the 10 percent quantile
    expect(probabilityAbove(QUANTILES, 2.5).value).toBeCloseTo(0.925, 10);
    // 80 is exactly the 85 percent quantile, so 15 percent lies above it
    expect(probabilityAbove(QUANTILES, 80).value).toBeCloseTo(0.15, 10);
  });

  it("gives only a bound outside the range of the quantiles", () => {
    for (const threshold of [-10, 0]) {
      const odds = probabilityAbove(QUANTILES, threshold);
      expect(odds.bound).toBe("over");
      expect(odds.value).toBeCloseTo(0.95, 10);
    }
    for (const threshold of [90, 500]) {
      const odds = probabilityAbove(QUANTILES, threshold);
      expect(odds.bound).toBe("under");
      expect(odds.value).toBeCloseTo(0.05, 10);
    }
  });

  it("falls with the threshold and rejects a wrong number of quantiles", () => {
    const values = [10, 30, 50, 70].map((k) => probabilityAbove(QUANTILES, k).value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
    expect(() => probabilityAbove([1, 2, 3], 2)).toThrow();
  });

  it("uses probabilities 0.05 to 0.95", () => {
    expect(ODDS_PROBS).toHaveLength(19);
    expect(ODDS_PROBS[0]).toBe(0.05);
    expect(ODDS_PROBS[18]).toBe(0.95);
  });
});

describe("oddsLabel", () => {
  it("writes a whole percent and marks a bound", () => {
    expect(oddsLabel({ value: 0.5, bound: "exact" })).toBe("50%");
    expect(oddsLabel({ value: 0.95, bound: "over" })).toBe("over 95%");
    expect(oddsLabel({ value: 0.05, bound: "under" })).toBe("under 5%");
  });
});

describe("thresholdsFor", () => {
  it("makes five round thresholds around the middle, with a step that depends on the target", () => {
    expect(thresholdsFor("payrolls", 112)).toEqual([0, 50, 100, 150, 200]);
    expect(thresholdsFor("cpi", 0.27)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(thresholdsFor("gdp", 2.4)).toEqual([0, 1, 2, 3, 4]);
  });
});
