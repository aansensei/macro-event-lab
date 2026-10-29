import { describe, expect, it } from "vitest";

import type { SeriesScores } from "../data/types";
import { missSize, scoreFinding, tailShare } from "./scoreWords";

const scores: SeriesScores = {
  n: 57, brier: 0.02, crps: 0.04, mae_market: 0.07, mae_naive: 0.15, skill: 0.533,
  pit_hist: [2, 6, 5, 6, 7, 5, 6, 5, 6, 3],
};

describe("missSize", () => {
  it("speaks in points or thousands of jobs", () => {
    expect(missSize("KXCPI", 0.0712)).toBe("0.07 pp");
    expect(missSize("KXPAYROLLS", 52300)).toBe("52k jobs");
  });
});

describe("tailShare", () => {
  it("is the share of PIT values in the outer tenths", () => {
    expect(tailShare(scores.pit_hist)).toBeCloseTo(5 / 51);
    expect(tailShare([0, 0])).toBeNull();
  });
});

describe("scoreFinding", () => {
  it("compares the market with repeating the last print and reads the tails", () => {
    const text = scoreFinding("KXCPI", "CPI", scores);
    expect(text).toContain("beat simply repeating last month's CPI: its typical miss was 0.07 pp, against 0.15 pp, 53% smaller.");
    expect(text).toContain("rarely reached the far ends of the odds (10% in the outer tenths");
  });

  it("says when the naive guess did as well", () => {
    const text = scoreFinding("KXFED", "FOMC", { ...scores, skill: -0.1, mae_market: 0.05, mae_naive: 0.04 });
    expect(text).toContain("Simply repeating the current rate did as well or better");
  });

  it("flags heavy tails", () => {
    const text = scoreFinding("KXGDP", "GDP", { ...scores, pit_hist: [4, 1, 1, 1, 1, 1, 1, 1, 1, 4] });
    expect(text).toContain("often landed in the far ends of the odds: 50% of GDP releases");
  });
});
