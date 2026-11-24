import { expect, it } from "vitest";

import { arenaFixture } from "../data/arenaFixture";
import { arenaRange, intervalCovered, leaderboardRows, relativeToNaive, sortLeaderboard } from "./arenaStats";

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
