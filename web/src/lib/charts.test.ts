import { describe, expect, it } from "vitest";

import type { Bin, Snapshot } from "../data/types";
import { dayTicks, fanDomain, fanSegments, niceTicks, oddsSegments, oddsSeries } from "./charts";

function snap(h: number, q: number | null, bins: Bin[] = []): Snapshot {
  return {
    h, ts: "2026-10-14T11:00:00Z", mean: q, sd: q === null ? null : 0.1,
    p05: q === null ? null : q - 0.2, p25: q === null ? null : q - 0.1, p50: q,
    p75: q === null ? null : q + 0.1, p95: q === null ? null : q + 0.2, bins, survival: [],
  };
}

describe("niceTicks", () => {
  it("picks round steps", () => {
    expect(niceTicks(0.31, 0.79)).toEqual([0.4, 0.5, 0.6, 0.7]);
    expect(niceTicks(-27000, 134000)).toEqual([0, 50000, 100000]);
    expect(niceTicks(3.6, 4.4)).toEqual([3.6, 3.8, 4, 4.2, 4.4]);
  });

  it("returns the single value for an empty range", () => {
    expect(niceTicks(2, 2)).toEqual([2]);
  });
});

describe("dayTicks", () => {
  it("marks every 24 hours down to the close", () => {
    expect(dayTicks(168)).toEqual([168, 144, 120, 96, 72, 48, 24, 0]);
    expect(dayTicks(50)).toEqual([48, 24, 0]);
  });
});

describe("fanSegments", () => {
  it("does not connect valid quantiles across an unrecorded hour", () => {
    expect(fanSegments([snap(5, 0.5), snap(4, 0.6), snap(1, 0.7), snap(0, 0.8)])
      .map(run => run.map(q => q.h))).toEqual([[5, 4], [1, 0]]);
  });
  it("splits the bands where a snapshot has no quantiles", () => {
    const segments = fanSegments([snap(4, 0.5), snap(3, 0.5), snap(2, null), snap(1, 0.6)]);
    expect(segments.map((s) => s.map((q) => q.h))).toEqual([[4, 3], [1]]);
  });

  it("pads the domain and includes extra marks", () => {
    const [lo, hi] = fanDomain(fanSegments([snap(1, 0.5)]), [1.3]);
    expect(lo).toBeCloseTo(0.3 - 0.05);
    expect(hi).toBeCloseTo(1.3 + 0.05);
  });
});

describe("oddsSegments", () => {
  it("breaks at both an absent probability and an unrecorded hour, keeping zero odds", () => {
    expect(oddsSegments([[7, 0], [6, 0.1], [5, null], [4, 0.2], [1, 0.3], [0, 0.4]]))
      .toEqual([[[7, 0], [6, 0.1]], [[4, 0.2]], [[1, 0.3], [0, 0.4]]]);
    expect(oddsSegments([])).toEqual([]);
    expect(oddsSegments([[1, null]])).toEqual([]);
  });
});

describe("oddsSeries", () => {
  const snaps = [
    snap(2, null, [[null, 3.5, 0.3], [3.5, 3.75, 0.6], [3.75, null, 0.1]]),
    snap(1, null, [[null, 3.25, 0.02], [3.25, 3.5, 0.08], [3.5, 3.75, 0.85], [3.75, null, 0.05]]),
  ];

  it("keeps outcomes that reached the threshold, ordered by rate", () => {
    const series = oddsSeries(snaps);
    expect(series.map((s) => s.key)).toEqual(["null|3.5", "3.5|3.75", "3.75|null"]);
    expect(series[1]?.peak).toBe(0.85);
  });

  it("leaves hours where an outcome was not listed empty", () => {
    const series = oddsSeries(snaps);
    expect(series[0]?.points).toEqual([[2, 0.3], [1, null]]);
  });

  it("limits the number of lines to the likeliest outcomes", () => {
    expect(oddsSeries(snaps, 0.1, 1).map((s) => s.key)).toEqual(["3.5|3.75"]);
  });
});
