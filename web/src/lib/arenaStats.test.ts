import { describe, expect, it } from "vitest";

import type { Arena } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import {
  arenaRange, contestantsPerTarget, intervalCovered, leaderboardRows, relativeToNaive, rmseWithoutYear,
  sortLeaderboard, worstPeriodShare,
} from "./arenaStats";

it("ranks RMSE with shared competition ranks and unavailable rows last", () => {
  const data = structuredClone(arenaFixture);
  data.scores[1]!.rmse = data.scores[0]!.rmse;
  data.contestants.push({ id: "fixture-d", label: "Fixture D", kind: "human", note: "" });
  data.scores.push({ ...data.scores[0]!, contestant: "fixture-d", rmse: 3 });
  const rows = leaderboardRows(data, "gdp", "all");
  expect(rows.map((row) => row.rank)).toEqual([1, 1, 3, null]);
  expect(leaderboardRows(data, "cpi", "all")).toEqual([]);
  expect(leaderboardRows(data, "gdp", "clean")).toEqual([]);
});

it("computes numeric percent differences with a valid nonzero naive denominator", () => {
  expect(relativeToNaive(1, 2)).toBe(-50);
  expect(relativeToNaive(3, 2)).toBe(50);
  expect(relativeToNaive(0, 2)).toBe(-100);
  expect(relativeToNaive(null, 2)).toBeNull();
  expect(relativeToNaive(1, null)).toBeNull();
  expect(relativeToNaive(1, 0)).toBeNull();
  expect(relativeToNaive(Infinity, 1)).toBeNull();
});

it("keeps ranks fixed when presenting a different sort and puts missing metrics last", () => {
  const rows = leaderboardRows(arenaFixture, "gdp", "all");
  expect(sortLeaderboard(rows, "rmse", "desc").map((row) => row.contestant)).toEqual(["naive", "fixture-b", "fixture-c"]);
  expect(sortLeaderboard(rows, "label", "asc").map((row) => row.contestant)).toEqual(["naive", "fixture-b", "fixture-c"]);
  expect(sortLeaderboard(rows, "coverage_90", "desc")[0]?.contestant).toBe("fixture-b");
  expect(rows[0]?.contestant).toBe("fixture-b");
});

it("checks both inclusive interval boundaries and keeps absence indeterminate", () => {
  const interval = { level: 0.9 as const, lo: 0, hi: 2 };
  expect(intervalCovered(0, interval)).toBe(true);
  expect(intervalCovered(2, interval)).toBe(true);
  expect(intervalCovered(3, interval)).toBe(false);
  expect(intervalCovered(null, interval)).toBeNull();
  expect(intervalCovered(1, null)).toBeNull();
  expect(intervalCovered(1, { ...interval, lo: null })).toBeNull();
  expect(intervalCovered(1, { ...interval, lo: 3 })).toBeNull();
});

it("uses the existing zero-based percentile convention, margin and explicit outlier flags", () => {
  const values = [...Array<number>(99).fill(1), -100, null];
  const range = arenaRange(values);
  expect(range.maximum).toBeCloseTo(1.15);
  expect(range.clipped.filter(Boolean)).toHaveLength(1);
  expect(range.clipped[99]).toBe(true);
  expect(range.clipped[100]).toBe(false);
  expect(arenaRange([1, 2, 100]).maximum).toBeCloseTo(115);
  expect(arenaRange([null, 0])).toEqual({ maximum: 0.1, clipped: [false, false] });
});

describe("worstPeriodShare", () => {
  const arena = {
    forecasts: [
      { target: "gdp", period: "2020-01-01", made_on: "2020-02-01", actual: 3, values: { a: 1, b: 3 }, intervals: {} },
      { target: "gdp", period: "2020-04-01", made_on: "2020-05-01", actual: 0, values: { a: 0, b: null }, intervals: {} },
      { target: "gdp", period: "2020-07-01", made_on: "2020-08-01", actual: 1, values: { a: -1 }, intervals: {} },
      { target: "cpi", period: "2020-07-01", made_on: "2020-08-01", actual: 9, values: { a: 0 }, intervals: {} },
    ],
  } as unknown as Arena;
  it("is the largest squared error divided by the total, for one target and contestant", () => {
    expect(worstPeriodShare(arena, "gdp", "a")).toBeCloseTo(0.5, 12);
  });
  it("is null when the contestant has no error or no forecast", () => {
    expect(worstPeriodShare(arena, "gdp", "b")).toBeNull();
    expect(worstPeriodShare(arena, "gdp", "missing")).toBeNull();
  });
});

describe("contestantsPerTarget", () => {
  const arena = {
    targets: [{ id: "gdp", label: "GDP growth" }, { id: "cpi", label: "Inflation" }],
    scores: [
      { target: "gdp", window: "all", contestant: "a", rmse: 1 },
      { target: "gdp", window: "all", contestant: "b", rmse: 2 },
      { target: "gdp", window: "all", contestant: "c", rmse: null },
      { target: "gdp", window: "clean", contestant: "d", rmse: 1 },
      { target: "cpi", window: "all", contestant: "a", rmse: 1 },
    ],
  } as unknown as Arena;
  it("counts contestants with a score in the full window for each target", () => {
    expect(contestantsPerTarget(arena)).toEqual([{ label: "GDP growth", count: 2 }, { label: "Inflation", count: 1 }]);
  });
});

describe("rmseWithoutYear", () => {
  const arena = {
    targets: [{ id: "gdp", label: "GDP growth" }],
    contestants: [{ id: "naive", label: "Naive", kind: "baseline", note: "" }, { id: "a", label: "A", kind: "classical", note: "" }],
    forecasts: [
      { target: "gdp", period: "2019-10-01", made_on: "2019-11-01", actual: 2, values: { naive: 0, a: 1 }, intervals: {} },
      { target: "gdp", period: "2020-04-01", made_on: "2020-05-01", actual: -30, values: { naive: 0, a: 0 }, intervals: {} },
      { target: "gdp", period: "2021-01-01", made_on: "2021-02-01", actual: 4, values: { naive: 0, a: 0 }, intervals: {} },
      { target: "cpi", period: "2021-01-01", made_on: "2021-02-01", actual: 9, values: { a: 0 }, intervals: {} },
    ],
    scores: [
      { target: "gdp", contestant: "naive", window: "all", n: 3, mae: 12, rmse: 17.4, coverage_90: null, dm_vs_naive_p: null },
      { target: "gdp", contestant: "a", window: "all", n: 3, mae: 11, rmse: 17.3, coverage_90: null, dm_vs_naive_p: null },
    ],
  } as unknown as Arena;
  it("leaves out every period that starts in the year and keeps the target and contestant apart", () => {
    // naive errors without 2020: 2 and 4, so sqrt((4 + 16) / 2); a: 1 and 4, so sqrt((1 + 16) / 2)
    expect(rmseWithoutYear(arena, "gdp", "naive", 2020)).toBeCloseTo(Math.sqrt(10), 12);
    expect(rmseWithoutYear(arena, "gdp", "a", 2020)).toBeCloseTo(Math.sqrt(8.5), 12);
    expect(rmseWithoutYear(arena, "cpi", "a", 2021)).toBeNull();
    expect(rmseWithoutYear(arena, "gdp", "missing", 2020)).toBeNull();
  });
  it("fills the leaderboard column only for the all periods window and compares with naive over the same periods", () => {
    const rows = leaderboardRows(arena, "gdp", "all");
    const a = rows.find((row) => row.contestant === "a")!;
    expect(a.rmseWithout2020).toBeCloseTo(Math.sqrt(8.5), 12);
    expect(a.relativeWithout2020).toBeCloseTo(100 * (Math.sqrt(8.5) / Math.sqrt(10) - 1), 10);
    expect(leaderboardRows(arena, "gdp", "clean").every((row) => row.rmseWithout2020 === null)).toBe(true);
  });
});
