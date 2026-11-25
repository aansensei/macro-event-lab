import { describe, expect, it } from "vitest";

import type { Arena } from "../data/arena";
import { buildRounds, loadProgress, parseGuess, saveProgress, scoreRound, summarize } from "./play";

const fakeArena: Arena = {
  schema_version: 1,
  information_date: "2026-11-20",
  targets: [
    { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
    { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
  ],
  contestants: [
    { id: "naive", label: "Naive", kind: "baseline", note: "Baseline." },
    { id: "ar", label: "Autoregression", kind: "classical", note: "Classical." },
    { id: "spf", label: "SPF", kind: "human", note: "Survey." },
  ],
  forecasts: [
    { target: "gdp", period: "2022-01-01", made_on: "2022-02-15", actual: 1.0, values: { naive: 1.1, ar: 1.2, spf: null }, intervals: {} },
    { target: "gdp", period: "2022-04-01", made_on: "2022-05-15", actual: null, values: { naive: 1.0, ar: 1.3, spf: 1.4 }, intervals: {} },
    { target: "gdp", period: "2022-07-01", made_on: "2022-08-15", actual: 2.1, values: { naive: 1.0, ar: 1.9, spf: null }, intervals: {} },
    { target: "gdp", period: "2022-10-01", made_on: "2022-11-15", actual: 2.3, values: { naive: 2.1, ar: null, spf: null }, intervals: {} },
    { target: "gdp", period: "2023-01-01", made_on: "2023-02-15", actual: 2.5, values: { naive: 2.3, ar: 2.4, spf: 2.6 }, intervals: {} },
    { target: "gdp", period: "2023-04-01", made_on: "2023-05-15", actual: 2.7, values: { naive: 2.5, ar: 2.8, spf: 2.6 }, intervals: {} },
    { target: "gdp", period: "2023-07-01", made_on: "2023-08-15", actual: 2.9, values: { naive: 2.7, ar: 2.8, spf: 3.0 }, intervals: {} },
    { target: "gdp", period: "2023-10-01", made_on: "2023-11-15", actual: 3.1, values: { naive: 2.9, ar: 3.0, spf: 3.2 }, intervals: {} },
    { target: "gdp", period: "2024-01-01", made_on: "2024-02-15", actual: 3.3, values: { naive: 3.1, ar: 3.2, spf: 3.4 }, intervals: {} },
    { target: "gdp", period: "2024-04-01", made_on: "2024-05-15", actual: 3.5, values: { naive: 3.3, ar: 3.4, spf: 3.6 }, intervals: {} },
    { target: "gdp", period: "2024-07-01", made_on: "2024-08-15", actual: 3.7, values: { naive: 3.5, ar: 3.6, spf: 3.8 }, intervals: {} },
    { target: "gdp", period: "2025-01-01", made_on: "2025-02-15", actual: 3.9, values: { naive: 3.7, ar: 3.8, spf: 4.0 }, intervals: {} },
    { target: "cpi", period: "2024-01-01", made_on: "2024-02-10", actual: 0.3, values: { naive: 0.2, ar: 0.4, spf: null }, intervals: {} },
    { target: "cpi", period: "2024-02-01", made_on: "2024-03-10", actual: 0.4, values: { naive: 0.3, ar: 0.35, spf: 0.45 }, intervals: {} },
    { target: "cpi", period: "2025-01-01", made_on: "2025-02-10", actual: 0.5, values: { naive: 0.4, ar: 0.45, spf: 0.55 }, intervals: {} },
  ],
  scores: [],
  leakage: [],
  live: [],
};

describe("play", () => {
  it("builds deterministic rounds for one seed and different orders for different seeds", () => {
    const first = buildRounds(fakeArena, 42, 5);
    const second = buildRounds(fakeArena, 42, 5);
    const otherSeed = buildRounds(fakeArena, 99, 5);
    expect(first).toEqual(second);
    expect(first.map((r) => `${r.target}:${r.period}`)).not.toEqual(otherSeed.map((r) => `${r.target}:${r.period}`));
  });

  it("picks distinct eligible rounds and respects hideYears", () => {
    const all = buildRounds(fakeArena, 7, 20);
    const keys = all.map((r) => `${r.target}:${r.period}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("gdp:2022-04-01");
    expect(keys).not.toContain("gdp:2022-10-01");

    const hidden = buildRounds(fakeArena, 7, 20, [2025]);
    expect(hidden.every((r) => !r.period.startsWith("2025-"))).toBe(true);
    expect(hidden.length).toBeLessThan(all.length);
  });

  it("keeps history strictly before the round period, ascending, non null, and at most 8 entries", () => {
    const rounds = buildRounds(fakeArena, 1, 20);
    const latestGdp = rounds.find((r) => r.target === "gdp" && r.period === "2025-01-01")!;
    expect(latestGdp).toBeDefined();
    expect(latestGdp.history).toHaveLength(8);
    expect(latestGdp.history.every((item) => item.period < latestGdp.period)).toBe(true);
    expect(latestGdp.history.map((item) => item.period)).toEqual([
      "2022-10-01",
      "2023-01-01",
      "2023-04-01",
      "2023-07-01",
      "2023-10-01",
      "2024-01-01",
      "2024-04-01",
      "2024-07-01",
    ]);
  });

  it("parses valid numeric texts and rejects invalid ones", () => {
    const accepted: [string, number][] = [
      ["0", 0],
      [" 4 ", 4],
      ["+0.3", 0.3],
      ["-2.5", -2.5],
      ["\u22121.5", -1.5],
      ["1,234.5", 1234.5],
      ["12,345", 12345],
      ["-1,234,567.89", -1234567.89],
      ["1000.25", 1000.25],
      ["-0", 0],
    ];
    for (const [text, expected] of accepted) {
      expect(parseGuess(text)).toBe(expected);
    }

    const rejected = [
      "",
      "   ",
      "abc",
      "1..2",
      "1.2.3",
      "1,23",
      "1234,567",
      "1e3",
      "Infinity",
      "1.",
      "-.5",
      "1 234",
    ];
    for (const text of rejected) {
      expect(parseGuess(text)).toBeNull();
    }
  });

  it("scores a round and computes rank with ties", () => {
    const round = {
      target: "gdp" as const,
      period: "2024-01-01",
      madeOn: "2024-02-15",
      unit: "annualized percent q/q",
      history: [],
      forecasts: [
        { id: "naive", label: "Naive", value: 1.0 },
        { id: "ar", label: "Autoregression", value: 2.5 },
        { id: "spf", label: "SPF", value: 3.0 },
      ],
      actual: 2.0,
    };

    const tiedBest = scoreRound(round, 1.5);
    expect(tiedBest.absError).toBeCloseTo(0.5);
    expect(tiedBest.rank).toBe(1);
    expect(tiedBest.entries.map((entry) => entry.youBeat)).toEqual([true, false, true]);

    const tiedSecond = scoreRound(round, 3.0);
    expect(tiedSecond.absError).toBeCloseTo(1.0);
    expect(tiedSecond.rank).toBe(2);
    expect(tiedSecond.entries.map((entry) => entry.youBeat)).toEqual([false, false, false]);
  });

  it("summarizes results with different round counts per contestant and handles empty input", () => {
    expect(summarize([])).toEqual({ rounds: 0, closerThanAll: 0, entries: [] });

    const r1 = scoreRound({
      target: "gdp",
      period: "2024-01-01",
      madeOn: "2024-02-15",
      unit: "%",
      history: [],
      forecasts: [
        { id: "naive", label: "Naive", value: 1.0 },
        { id: "spf", label: "SPF", value: 2.25 },
      ],
      actual: 2.0,
    }, 1.5);

    const r2 = scoreRound({
      target: "gdp",
      period: "2024-04-01",
      madeOn: "2024-05-15",
      unit: "%",
      history: [],
      forecasts: [
        { id: "naive", label: "Naive", value: 5.0 },
      ],
      actual: 2.0,
    }, 2.5);

    const summary = summarize([r1, r2]);
    expect(summary.rounds).toBe(2);
    expect(summary.closerThanAll).toBe(1);
    expect(summary.entries).toEqual([
      { id: "naive", label: "Naive", rounds: 2, youCloser: 2, youWon: true },
      { id: "spf", label: "SPF", rounds: 1, youCloser: 0, youWon: false },
    ]);
  });

  it("counts rounds instead of averaging errors that are in different units", () => {
    const gdp = scoreRound({
      target: "gdp", period: "2024-01-01", madeOn: "2024-02-15", unit: "%", history: [],
      forecasts: [{ id: "naive", label: "Naive", value: 1.0 }], actual: 2.0,
    }, 1.9);
    const payrolls = scoreRound({
      target: "payrolls", period: "2024-02-01", madeOn: "2024-03-01", unit: "thousand jobs", history: [],
      forecasts: [{ id: "naive", label: "Naive", value: 150000 }], actual: 200000,
    }, 120000);
    const summary = summarize([gdp, payrolls]);
    expect(summary.entries).toEqual([{ id: "naive", label: "Naive", rounds: 2, youCloser: 1, youWon: false }]);
    expect(summary).not.toHaveProperty("yourMeanAbsError");
  });

  it("saves and loads progress and survives throwing or invalid storage", () => {
    const store = new Map<string, string>();
    const storage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => { store.set(key, value); },
    };

    const result = scoreRound({
      target: "cpi",
      period: "2024-01-01",
      madeOn: "2024-02-10",
      unit: "percent m/m",
      history: [],
      forecasts: [{ id: "naive", label: "Naive", value: 0.2 }],
      actual: 0.3,
    }, 0.25);

    saveProgress(storage, [result]);
    expect(store.has("mel-play-progress-v1")).toBe(true);
    expect(loadProgress(storage)).toEqual([result]);

    const throwingStorage: Pick<Storage, "getItem" | "setItem"> = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("quota"); },
    };
    expect(() => saveProgress(throwingStorage, [result])).not.toThrow();
    expect(loadProgress(throwingStorage)).toEqual([]);

    for (const bad of ["{", "[1,2]", JSON.stringify([{ guess: "bad", actual: 1, absError: 1 }])]) {
      store.set("mel-play-progress-v1", bad);
      expect(loadProgress(storage)).toEqual([]);
    }
  });
});
