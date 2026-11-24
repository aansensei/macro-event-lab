import { describe, expect, it } from "vitest";

import type { Arena } from "../data/arena";
import {
  type PlayRound,
  buildRounds,
  loadProgress,
  parseGuess,
  saveProgress,
  scoreRound,
  summarize,
} from "./play";

// Build a fake arena with two targets, 12 rows per target, 3 contestants, nulls, and two years.
// Every row has a unique actual so history leakage checks can assert the round actual never appears.
const FAKE_ARENA: Arena = {
  schema_version: 1,
  information_date: "2025-11-24",
  targets: [
    { id: "gdp", label: "US GDP growth", unit: "percent", frequency: "quarterly" },
    { id: "cpi", label: "US CPI", unit: "percent", frequency: "monthly" },
  ],
  contestants: [
    { id: "naive", label: "Naive", kind: "baseline", note: "Prior print" },
    { id: "ar", label: "Autoregression", kind: "classical", note: "AR model" },
    { id: "spf", label: "Survey", kind: "human", note: "Median survey" },
  ],
  forecasts: [
    // Candidate 0 (gdp, 2024)
    { target: "gdp", period: "2024-01-01", made_on: "2024-04-01", actual: 1.4, values: { spf: 1.8, ar: 1.5, naive: 2.0 }, intervals: {} },
    // Candidate 1 (gdp, 2024)
    { target: "gdp", period: "2024-04-01", made_on: "2024-07-01", actual: 2.8, values: { naive: 1.4, ar: 2.1, spf: null }, intervals: {} },
    // Non candidate: null actual (skipped in candidates and skipped in history)
    { target: "gdp", period: "2024-07-01", made_on: "2024-10-01", actual: null, values: { naive: 2.8, ar: 2.4, spf: 2.5 }, intervals: {} },
    // Candidate 2 (gdp, 2024)
    { target: "gdp", period: "2024-10-01", made_on: "2025-01-01", actual: 2.3, values: { naive: 2.8, ar: 2.2, spf: 2.4 }, intervals: {} },
    // Non candidate: fewer than two non null values (still valid history because actual is non null)
    { target: "gdp", period: "2025-01-01", made_on: "2025-04-01", actual: -0.3, values: { naive: 2.3, ar: null, spf: null }, intervals: {} },
    // Candidate 3 (gdp, 2025)
    { target: "gdp", period: "2025-04-01", made_on: "2025-07-01", actual: 3.1, values: { spf: 2.7, ar: 2.5, naive: -0.3 }, intervals: {} },
    // Non candidate: zero non null values
    { target: "gdp", period: "2025-07-01", made_on: "2025-10-01", actual: 1.9, values: {}, intervals: {} },
    // Non candidate: historical gdp rows from 2022 and 2023 placed out of period order to verify history sort and cap of 8
    { target: "gdp", period: "2023-07-01", made_on: "2023-10-01", actual: 4.4, values: { naive: 2.1 }, intervals: {} },
    { target: "gdp", period: "2022-04-01", made_on: "2022-07-01", actual: -0.6, values: { naive: 1.1 }, intervals: {} },
    { target: "gdp", period: "2023-01-01", made_on: "2023-04-01", actual: 2.6, values: { naive: 2.5 }, intervals: {} },
    { target: "gdp", period: "2022-10-01", made_on: "2023-01-01", actual: 3.2, values: { naive: 2.9 }, intervals: {} },
    { target: "gdp", period: "2023-10-01", made_on: "2024-01-01", actual: 3.4, values: { naive: 4.4 }, intervals: {} },

    // Candidate 4 (cpi, 2024)
    { target: "cpi", period: "2024-01-01", made_on: "2024-02-01", actual: 3.09, values: { naive: 3.3, ar: 3.0, spf: 2.9 }, intervals: {} },
    // Candidate 5 (cpi, 2024)
    { target: "cpi", period: "2024-02-01", made_on: "2024-03-01", actual: 3.15, values: { naive: 3.09, ar: 3.1, spf: null }, intervals: {} },
    // Candidate 6 (cpi, 2024)
    { target: "cpi", period: "2024-03-01", made_on: "2024-04-01", actual: 3.48, values: { naive: 3.15, ar: 3.3, spf: 3.4 }, intervals: {} },
    // Non candidate: null actual
    { target: "cpi", period: "2024-04-01", made_on: "2024-05-01", actual: null, values: { naive: 3.48, ar: 3.4, spf: 3.4 }, intervals: {} },
    // Candidate 7 (cpi, 2024)
    { target: "cpi", period: "2024-05-01", made_on: "2024-06-01", actual: 3.27, values: { naive: 3.48, ar: null, spf: 3.3 }, intervals: {} },
    // Candidate 8 (cpi, 2025)
    { target: "cpi", period: "2025-01-01", made_on: "2025-02-01", actual: 2.99, values: { naive: 2.89, ar: 2.95, spf: 2.9 }, intervals: {} },
    // Candidate 9 (cpi, 2025)
    { target: "cpi", period: "2025-02-01", made_on: "2025-03-01", actual: 2.81, values: { naive: 2.99, ar: 2.85, spf: 2.8 }, intervals: {} },
    // Candidate 10 (cpi, 2025)
    { target: "cpi", period: "2025-03-01", made_on: "2025-04-01", actual: 2.39, values: { naive: 2.81, ar: 2.6, spf: 2.5 }, intervals: {} },
    // Candidate 11 (cpi, 2025)
    { target: "cpi", period: "2025-04-01", made_on: "2025-05-01", actual: 2.31, values: { naive: 2.39, ar: 2.4, spf: 2.35 }, intervals: {} },
    // Non candidate: fewer than two non null values
    { target: "cpi", period: "2025-05-01", made_on: "2025-06-01", actual: 2.35, values: { naive: null, ar: 2.4, spf: null }, intervals: {} },
    // Non candidate: null actual at end of 2025
    { target: "cpi", period: "2025-06-01", made_on: "2025-07-01", actual: null, values: { naive: 2.35, ar: 2.38, spf: 2.4 }, intervals: {} },
    // Non candidate: historical cpi row from 2023 with only one value
    { target: "cpi", period: "2023-12-01", made_on: "2024-01-01", actual: 3.35, values: { naive: 3.1 }, intervals: {} },
  ],
  scores: [],
  leakage: [],
  live: [],
};

// Candidate list in original order has 12 entries indexed 0..11:
// 0: gdp 2024-01-01, 1: gdp 2024-04-01, 2: gdp 2024-10-01, 3: gdp 2025-04-01,
// 4: cpi 2024-01-01, 5: cpi 2024-02-01, 6: cpi 2024-03-01, 7: cpi 2024-05-01,
// 8: cpi 2025-01-01, 9: cpi 2025-02-01, 10: cpi 2025-03-01, 11: cpi 2025-04-01.

describe("buildRounds", () => {
  it("matches the exact Fisher Yates order from mulberry32 for seed 1 and count 3", () => {
    // Hand trace of mulberry32 starting at a = 1 over array [0..11]:
    // i = 11: a = 0x6d2b79f6, next() = 0.627073940588, j = floor(12 * 0.627073940588) = 7, swap(11, 7) gives [0,1,2,3,4,5,6,11,8,9,10,7]
    // i = 10: a = 0xda56f3eb, next() = 0.002735721180, j = floor(11 * 0.002735721180) = 0, swap(10, 0) gives [10,1,2,3,4,5,6,11,8,9,0,7]
    // i = 9:  a = 0x47826de0, next() = 0.527447039960, j = floor(10 * 0.527447039960) = 5, swap(9, 5)  gives [10,1,2,3,4,9,6,11,8,5,0,7]
    // i = 8:  a = 0xb4ade7d5, next() = 0.981050967472, j = floor(9 * 0.981050967472)  = 8, swap(8, 8)  gives [10,1,2,3,4,9,6,11,8,5,0,7]
    // i = 7:  a = 0x21d961ca, next() = 0.968377898214, j = floor(8 * 0.968377898214)  = 7, swap(7, 7)  gives [10,1,2,3,4,9,6,11,8,5,0,7]
    // i = 6:  a = 0x8f04dbbf, next() = 0.281103502959, j = floor(7 * 0.281103502959)  = 1, swap(6, 1)  gives [10,6,2,3,4,9,1,11,8,5,0,7]
    // i = 5:  a = 0xfc3055b4, next() = 0.612838860601, j = floor(6 * 0.612838860601)  = 3, swap(5, 3)  gives [10,6,2,9,4,3,1,11,8,5,0,7]
    // i = 4:  a = 0x695bcfa9, next() = 0.720743141137, j = floor(5 * 0.720743141137)  = 3, swap(4, 3)  gives [10,6,2,4,9,3,1,11,8,5,0,7]
    // i = 3:  a = 0xd687499e, next() = 0.425796952099, j = floor(4 * 0.425796952099)  = 1, swap(3, 1)  gives [10,4,2,6,9,3,1,11,8,5,0,7]
    // i = 2:  a = 0x43b2c393, next() = 0.994822945679, j = floor(3 * 0.994822945679)  = 2, swap(2, 2)  gives [10,4,2,6,9,3,1,11,8,5,0,7]
    // i = 1:  a = 0xb0de3d88, next() = 0.455271127168, j = floor(2 * 0.455271127168)  = 0, swap(1, 0)  gives [4,10,2,6,9,3,1,11,8,5,0,7]
    // First 3 candidate indices are 4 (cpi 2024-01-01), 10 (cpi 2025-03-01), and 2 (gdp 2024-10-01).
    const rounds: PlayRound[] = buildRounds(FAKE_ARENA, 1, 3);
    expect(rounds.map((r) => `${r.target}:${r.period}`)).toEqual([
      "cpi:2024-01-01",
      "cpi:2025-03-01",
      "gdp:2024-10-01",
    ]);
  });

  it("is deterministic for a seed, picks distinct candidates, and varies order across seeds", () => {
    const first = buildRounds(FAKE_ARENA, 42, 5);
    const second = buildRounds(FAKE_ARENA, 42, 5);
    expect(first).toEqual(second);
    expect(first).toHaveLength(5);

    const keys = first.map((r) => `${r.target}:${r.period}`);
    expect(new Set(keys).size).toBe(5);

    const third = buildRounds(FAKE_ARENA, 99, 5);
    expect(third.map((r) => `${r.target}:${r.period}`)).not.toEqual(keys);

    const all = buildRounds(FAKE_ARENA, 7, 50);
    expect(all).toHaveLength(12);
    expect(new Set(all.map((r) => `${r.target}:${r.period}`)).size).toBe(12);
  });

  it("excludes rows in hideYears and keeps unit, madeOn, contestant order, and history", () => {
    const only2025 = buildRounds(FAKE_ARENA, 1, 20, [2024]);
    expect(only2025).toHaveLength(5);
    for (const round of only2025) {
      expect(round.period.startsWith("2025-")).toBe(true);
    }

    const gdp2025 = only2025.find((r) => r.target === "gdp" && r.period === "2025-04-01")!;
    expect(gdp2025).toBeDefined();
    expect(gdp2025.madeOn).toBe("2025-07-01");
    expect(gdp2025.unit).toBe("percent");
    expect(gdp2025.actual).toBe(3.1);
    // Input row keys were spf, ar, naive; output must follow arena.contestants order: naive, ar, spf.
    expect(gdp2025.forecasts).toEqual([
      { id: "naive", label: "Naive", value: -0.3 },
      { id: "ar", label: "Autoregression", value: 2.5 },
      { id: "spf", label: "Survey", value: 2.7 },
    ]);
    // Earlier gdp periods with non null actuals are the nine of 2022-04, 2022-10, 2023-01, 2023-07, 2023-10,
    // 2024-01, 2024-04, 2024-10 and 2025-01 (2024-07 is null), so the last eight are kept.
    expect(gdp2025.history).toEqual([
      { period: "2022-10-01", value: 3.2 },
      { period: "2023-01-01", value: 2.6 },
      { period: "2023-07-01", value: 4.4 },
      { period: "2023-10-01", value: 3.4 },
      { period: "2024-01-01", value: 1.4 },
      { period: "2024-04-01", value: 2.8 },
      { period: "2024-10-01", value: 2.3 },
      { period: "2025-01-01", value: -0.3 },
    ]);

    const cpi2025 = only2025.find((r) => r.target === "cpi" && r.period === "2025-04-01")!;
    expect(cpi2025).toBeDefined();
    // 8 earlier cpi periods have a non null actual (2024-04-01 is null), so all eight are kept.
    expect(cpi2025.history).toEqual([
      { period: "2023-12-01", value: 3.35 },
      { period: "2024-01-01", value: 3.09 },
      { period: "2024-02-01", value: 3.15 },
      { period: "2024-03-01", value: 3.48 },
      { period: "2024-05-01", value: 3.27 },
      { period: "2025-01-01", value: 2.99 },
      { period: "2025-02-01", value: 2.81 },
      { period: "2025-03-01", value: 2.39 },
    ].slice(-8));
  });

  it("caps history at 8 entries when more than 8 earlier non null periods exist", () => {
    const extended: Arena = {
      ...FAKE_ARENA,
      forecasts: [
        ...FAKE_ARENA.forecasts,
        { target: "cpi", period: "2023-10-01", made_on: "2023-11-01", actual: 3.24, values: { naive: 3.7 }, intervals: {} },
        { target: "cpi", period: "2023-11-01", made_on: "2023-12-01", actual: 3.14, values: { naive: 3.24 }, intervals: {} },
      ],
    };
    const round = buildRounds(extended, 1, 20).find((r) => r.target === "cpi" && r.period === "2025-04-01")!;
    expect(round.history).toHaveLength(8);
    expect(round.history.map((h) => h.period)).toEqual([
      "2023-12-01",
      "2024-01-01",
      "2024-02-01",
      "2024-03-01",
      "2024-05-01",
      "2025-01-01",
      "2025-02-01",
      "2025-03-01",
    ]);
  });

  it("never leaks future periods or round actuals into history across 200 seeds", () => {
    const actualByTargetPeriod = new Map<string, number>();
    for (const row of FAKE_ARENA.forecasts) {
      if (row.actual !== null) {
        actualByTargetPeriod.set(`${row.target}:${row.period}`, row.actual);
      }
    }

    for (let seed = 1; seed <= 200; seed++) {
      const rounds = buildRounds(FAKE_ARENA, seed, 6);
      for (const round of rounds) {
        expect(round.history.length).toBeLessThanOrEqual(8);
        let prevPeriod = "";
        for (const item of round.history) {
          expect(item.period < round.period).toBe(true);
          expect(item.period > prevPeriod).toBe(true);
          expect(item.value).toBe(actualByTargetPeriod.get(`${round.target}:${item.period}`));
          expect(item.value).not.toBe(round.actual);
          prevPeriod = item.period;
        }
      }
    }
  });
});

describe("parseGuess", () => {
  it("parses valid numbers with optional sign, spaces, thousands separators, and decimals", () => {
    expect(parseGuess("1,234.5")).toBe(1234.5);
    expect(parseGuess("+0.3")).toBe(0.3);
    expect(parseGuess("\u22121.5")).toBe(-1.5);
    expect(parseGuess(" 4 ")).toBe(4);
    expect(parseGuess("0")).toBe(0);
    expect(parseGuess("42")).toBe(42);
    expect(parseGuess("-2.75")).toBe(-2.75);
    expect(parseGuess("1,234,567")).toBe(1234567);
    expect(parseGuess("-12,345.05")).toBe(-12345.05);
    expect(parseGuess("+1,000")).toBe(1000);
    expect(parseGuess("  \u22122,500.25  ")).toBe(-2500.25);
    expect(parseGuess("0.125")).toBe(0.125);
    expect(parseGuess("10000.5")).toBe(10000.5);
  });

  it("handles omitted digits on one side of the decimal point without throwing or returning NaN", () => {
    const leadingDot = parseGuess("-.5");
    expect(leadingDot === -0.5 || leadingDot === null).toBe(true);
    const trailingDot = parseGuess("1.");
    expect(trailingDot === 1 || trailingDot === null).toBe(true);
  });

  it("rejects empty strings, malformed separators, extra points, letters, and non finite values", () => {
    const invalidInputs = [
      "",
      "   ",
      "+",
      "-",
      "\u2212",
      "1,23",
      "1234,567",
      "1,234,56",
      ",123",
      "1,234,",
      "1.2,345",
      "1..2",
      "1.2.3",
      "abc",
      "1e3",
      "1E3",
      "Infinity",
      "-Infinity",
      "NaN",
      "1 000",
      "$10",
      "10%",
      "9".repeat(400),
    ];
    for (const raw of invalidInputs) {
      expect(parseGuess(raw)).toBeNull();
    }
  });
});

describe("scoreRound", () => {
  const sampleRound: PlayRound = {
    target: "gdp",
    period: "2025-04-01",
    madeOn: "2025-07-01",
    unit: "percent",
    history: [{ period: "2025-01-01", value: 1.0 }],
    forecasts: [
      { id: "a", label: "Alpha", value: 2.0 },
      { id: "b", label: "Beta", value: 2.5 },
      { id: "c", label: "Gamma", value: 3.5 },
    ],
    actual: 3.0,
  };

  it("computes errors, entry order, strict youBeat, and competition rank on ties", () => {
    // Guess 2.5 matches Beta (absError 0.5), beats Alpha (1.0), ties Gamma (0.5): 0 contestants strictly better gives rank 1.
    const tiedTop = scoreRound(sampleRound, 2.5);
    expect(tiedTop.guess).toBe(2.5);
    expect(tiedTop.actual).toBe(3.0);
    expect(tiedTop.absError).toBe(0.5);
    expect(tiedTop.rank).toBe(1);
    expect(tiedTop.entries).toEqual([
      { id: "a", label: "Alpha", absError: 1.0, youBeat: true },
      { id: "b", label: "Beta", absError: 0.5, youBeat: false },
      { id: "c", label: "Gamma", absError: 0.5, youBeat: false },
    ]);

    // Guess 2.0 has absError 1.0, ties Alpha, behind Beta and Gamma gives rank 3.
    const behindTwo = scoreRound(sampleRound, 2.0);
    expect(behindTwo.absError).toBe(1.0);
    expect(behindTwo.rank).toBe(3);
    expect(behindTwo.entries.map((e) => e.youBeat)).toEqual([false, false, false]);

    // Guess 3.25 has absError 0.25, beats everyone gives rank 1.
    const clearWin = scoreRound(sampleRound, 3.25);
    expect(clearWin.absError).toBe(0.25);
    expect(clearWin.rank).toBe(1);
    expect(clearWin.entries.map((e) => e.youBeat)).toEqual([true, true, true]);
  });
});

describe("summarize", () => {
  it("returns null mean and empty entries when given no results", () => {
    expect(summarize([])).toEqual({
      rounds: 0,
      yourMeanAbsError: null,
      entries: [],
    });
  });

  it("computes contestant means over their own rounds and compares against your error on those same rounds", () => {
    const r0 = {
      guess: 2.5,
      actual: 3.0,
      absError: 0.5,
      rank: 2,
      entries: [
        { id: "a", label: "Alpha", absError: 0.5, youBeat: false },
        { id: "b", label: "Beta", absError: 0.25, youBeat: false },
        { id: "c", label: "Gamma", absError: 1.0, youBeat: true },
      ],
    };
    const r1 = {
      guess: 0.0,
      actual: 4.0,
      absError: 4.0,
      rank: 2,
      entries: [
        { id: "a", label: "Alpha", absError: 4.0, youBeat: false },
        { id: "b", label: "Beta", absError: 1.75, youBeat: false },
      ],
    };
    const r2 = {
      guess: 2.0,
      actual: 3.5,
      absError: 1.5,
      rank: 1,
      entries: [
        { id: "a", label: "Alpha", absError: 3.0, youBeat: true },
      ],
    };

    const summary = summarize([r0, r1, r2]);
    // Your overall mean: (0.5 + 4.0 + 1.5) / 3 = 2.0.
    // Alpha over r0, r1, r2: mean (0.5 + 4.0 + 3.0) / 3 = 2.5 vs yours 2.0 gives youWon true.
    // Beta over r0, r1: mean (0.25 + 1.75) / 2 = 1.0 vs yours (0.5 + 4.0) / 2 = 2.25 gives youWon false.
    // Gamma over r0 only: mean 1.0 vs yours 0.5 (even though your overall mean is 2.0) gives youWon true.
    expect(summary.rounds).toBe(3);
    expect(summary.yourMeanAbsError).toBe(2.0);
    expect(summary.entries).toEqual([
      { id: "a", label: "Alpha", meanAbsError: 2.5, youWon: true },
      { id: "b", label: "Beta", meanAbsError: 1.0, youWon: false },
      { id: "c", label: "Gamma", meanAbsError: 1.0, youWon: true },
    ]);

    // Tie in mean error gives youWon false.
    const tiedSummary = summarize([r0]);
    expect(tiedSummary.entries.find((e) => e.id === "a")?.youWon).toBe(false);
  });
});

describe("saveProgress and loadProgress", () => {
  it("round trips results under mel-play-progress-v1", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    const results = [
      {
        guess: 2.5,
        actual: 3.0,
        absError: 0.5,
        rank: 1,
        entries: [{ id: "a", label: "Alpha", absError: 1.0, youBeat: true }],
      },
    ];
    saveProgress(storage, results);
    expect(map.has("mel-play-progress-v1")).toBe(true);
    expect(loadProgress(storage)).toEqual(results);
  });

  it("survives storage errors and rejects malformed JSON payloads", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => saveProgress(throwingStorage, [])).not.toThrow();
    expect(loadProgress(throwingStorage)).toEqual([]);

    const badPayloads: (string | null)[] = [
      null,
      "",
      "{",
      "[1,2]",
      "{\"guess\":1,\"actual\":2,\"absError\":1}",
      "[{\"guess\":\"1\",\"actual\":2,\"absError\":1}]",
      "[{\"guess\":1,\"actual\":null,\"absError\":1}]",
    ];
    for (const payload of badPayloads) {
      const storage = {
        getItem: () => payload,
        setItem: () => {},
      };
      expect(loadProgress(storage)).toEqual([]);
    }
  });
});
