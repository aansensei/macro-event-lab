import { describe, expect, it } from "vitest";

import type { Bin, Snapshot } from "../data/types";
import {
  binIndexOf,
  defaultHour,
  eventStatus,
  hourBounds,
  matchBins,
  modeIndex,
  daysClosedBefore,
  releaseWhen,
  snapshotAt,
} from "./snapshots";

function snap(h: number): Snapshot {
  return {
    h, ts: "2026-10-14T11:00:00Z", mean: null, sd: null,
    p05: null, p25: null, p50: null, p75: null, p95: null, bins: [], survival: [],
  };
}

// h 168, 48, 3, 1: a gap between 48 and 3 like an hour with no usable price
const snaps = [snap(168), snap(48), snap(3), snap(1)];

describe("snapshotAt", () => {
  it("returns the exact hour when it exists", () => {
    expect(snapshotAt(snaps, 48)?.h).toBe(48);
  });

  it("falls back to the newest earlier snapshot, never a later one", () => {
    expect(snapshotAt(snaps, 24)?.h).toBe(48);
    expect(snapshotAt(snaps, 2)?.h).toBe(3);
    expect(snapshotAt(snaps, 0)?.h).toBe(1);
  });

  it("has nothing before the first snapshot", () => {
    expect(snapshotAt(snaps, 200)).toBeNull();
  });
});

describe("hours", () => {
  it("finds the range and prefers T-1h as the default", () => {
    expect(hourBounds(snaps)).toEqual({ max: 168, min: 1 });
    expect(defaultHour(snaps)).toBe(1);
  });

  it("uses the newest hour when the market has not reached T-1h", () => {
    expect(defaultHour([snap(168), snap(82)])).toBe(82);
  });
});

describe("bins", () => {
  const bins: Bin[] = [[null, 0.4, 0.1], [0.4, 0.5, 0.2], [0.5, 0.6, 0.56], [0.6, null, 0.14]];

  it("matches earlier probabilities by exact interval", () => {
    const earlier: Bin[] = [[null, 0.4, 0.3], [0.4, 0.5, 0.25], [0.5, null, 0.45]];
    expect(matchBins(bins, earlier)).toEqual([0.3, 0.25, null, null]);
  });

  it("finds the mode", () => {
    expect(modeIndex(bins)).toBe(2);
    expect(modeIndex([])).toBe(-1);
  });

  it("places a print in its (lower, upper] bin, including the upper edge", () => {
    expect(binIndexOf(bins, 0.6)).toBe(2);
    expect(binIndexOf(bins, 0.4)).toBe(0);
    expect(binIndexOf(bins, 0.7)).toBe(3);
    expect(binIndexOf(bins, null)).toBe(-1);
  });
});

describe("eventStatus", () => {
  const through = "2026-10-27T02:00:00Z";

  it("is published once there is a first print", () => {
    expect(eventStatus({ first_print: 0.6, close: "2026-10-14T12:29:00Z" }, through)).toBe("published");
  });

  it("is upcoming while the market closes after the data ends", () => {
    expect(eventStatus({ first_print: null, close: "2026-10-30T12:29:00Z" }, through)).toBe("upcoming");
  });

  it("is not published when the close has passed without a print", () => {
    expect(eventStatus({ first_print: null, close: "2025-11-13T13:29:00Z" }, through)).toBe("not_published");
  });
});

describe("releaseWhen", () => {
  it("uses the release date and the BLS time", () => {
    expect(releaseWhen({ series: "KXCPI", release_date: "2026-10-14", close: "2026-10-14T12:29:00Z" }))
      .toEqual({ date: "Oct 14 2026", time: "08:30 ET" });
  });

  it("uses the close date in New York and 14:00 for FOMC", () => {
    expect(releaseWhen({ series: "KXFED", release_date: null, close: "2026-10-28T17:55:00Z" }))
      .toEqual({ date: "Oct 28 2026", time: "14:00 ET" });
  });
});

describe("daysClosedBefore", () => {
  it("counts New York calendar days from an early close to the release", () => {
    expect(daysClosedBefore({ release_date: "2021-08-11", close: "2021-08-10T23:00:00Z" })).toBe(1);
    expect(daysClosedBefore({ release_date: "2021-07-28", close: "2021-07-26T23:00:00Z" })).toBe(2);
    // 00:00 UTC is still the previous evening in New York
    expect(daysClosedBefore({ release_date: "2021-12-15", close: "2021-12-15T00:00:00Z" })).toBe(1);
  });
  it("gives 0 for a close on the release day or an unknown release", () => {
    expect(daysClosedBefore({ release_date: "2026-10-14", close: "2026-10-14T12:29:00Z" })).toBe(0);
    expect(daysClosedBefore({ release_date: null, close: "2026-10-14T12:29:00Z" })).toBe(0);
  });
});
