import type { Arena, TargetId } from "../data/arena";

export type PlayRound = {
  target: TargetId;
  period: string;
  madeOn: string;
  unit: string;
  history: { period: string; value: number }[];
  forecasts: { id: string; label: string; value: number }[];
  actual: number;
};

const STORAGE_KEY = "mel-play-progress-v1";
const MAX_HISTORY = 8;

function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// build a deterministic set of past rounds using only history strictly earlier than each round
export function buildRounds(arena: Arena, seed: number, count: number, hideYears?: number[]): PlayRound[] {
  if (count <= 0) return [];
  const hidden = hideYears ? new Set(hideYears) : null;
  const targetUnits = new Map(arena.targets.map((target) => [target.id, target.unit]));
  const candidates = arena.forecasts.filter((row) => {
    if (row.actual === null) return false;
    if (hidden && hidden.has(Number(row.period.slice(0, 4)))) return false;
    let nonNullCount = 0;
    for (const contestant of arena.contestants) {
      const value = row.values[contestant.id];
      if (value !== null && value !== undefined) nonNullCount += 1;
    }
    return nonNullCount >= 2;
  });

  const pool = [...candidates];
  const next = mulberry32(seed);
  for (let i = pool.length - 1; i >= 1; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const current = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = current;
  }

  return pool.slice(0, count).map((row) => {
    const history = arena.forecasts
      .filter((other) => other.target === row.target && other.period < row.period && other.actual !== null)
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-MAX_HISTORY)
      .map((other) => ({ period: other.period, value: other.actual! }));

    const forecasts = arena.contestants.flatMap((contestant) => {
      const value = row.values[contestant.id];
      return value === null || value === undefined ? [] : [{ id: contestant.id, label: contestant.label, value }];
    });

    return {
      target: row.target,
      period: row.period,
      madeOn: row.made_on,
      unit: targetUnits.get(row.target) ?? "",
      history,
      forecasts,
      actual: row.actual!,
    };
  });
}

// parse a human forecast with optional sign, thousands commas and decimal point
export function parseGuess(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = /^([+\-\u2212])?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;
  const sign = match[1] === "-" || match[1] === "\u2212" ? -1 : 1;
  const whole = match[2]!.replaceAll(",", "");
  const frac = match[3] ? `.${match[3]}` : "";
  const value = sign * Number(`${whole}${frac}`);
  if (!Number.isFinite(value)) return null;
  return value === 0 ? 0 : value;
}

export function scoreRound(round: PlayRound, guess: number) {
  const absError = Math.abs(guess - round.actual);
  const entries = round.forecasts.map((forecast) => {
    const contestantError = Math.abs(forecast.value - round.actual);
    return {
      id: forecast.id,
      label: forecast.label,
      absError: contestantError,
      youBeat: absError < contestantError,
    };
  });
  const rank = 1 + entries.filter((entry) => entry.absError < absError).length;
  return { guess, actual: round.actual, absError, rank, entries };
}

export function summarize(results: ReturnType<typeof scoreRound>[]) {
  if (results.length === 0) {
    return { rounds: 0, yourMeanAbsError: null, entries: [] };
  }
  const yourMeanAbsError = results.reduce((sum, result) => sum + result.absError, 0) / results.length;
  const byId = new Map<string, { id: string; label: string; contestantSum: number; yourSum: number; count: number }>();
  for (const result of results) {
    for (const entry of result.entries) {
      let stats = byId.get(entry.id);
      if (!stats) {
        stats = { id: entry.id, label: entry.label, contestantSum: 0, yourSum: 0, count: 0 };
        byId.set(entry.id, stats);
      }
      stats.contestantSum += entry.absError;
      stats.yourSum += result.absError;
      stats.count += 1;
    }
  }
  const entries = [...byId.values()].map((stats) => {
    const meanAbsError = stats.contestantSum / stats.count;
    const yourMeanOnSame = stats.yourSum / stats.count;
    return {
      id: stats.id,
      label: stats.label,
      meanAbsError,
      youWon: yourMeanOnSame < meanAbsError,
    };
  });
  return { rounds: results.length, yourMeanAbsError, entries };
}

function isValidStoredResult(item: unknown): item is ReturnType<typeof scoreRound> {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.guess === "number" && Number.isFinite(record.guess)
    && typeof record.actual === "number" && Number.isFinite(record.actual)
    && typeof record.absError === "number" && Number.isFinite(record.absError)
  );
}

export function saveProgress(storage: Pick<Storage, "getItem" | "setItem">, results: ReturnType<typeof scoreRound>[]): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch {
    // ignore storage write failures
  }
}

export function loadProgress(storage: Pick<Storage, "getItem" | "setItem">): ReturnType<typeof scoreRound>[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isValidStoredResult)) return [];
    return parsed.map((item) => ({
      guess: item.guess,
      actual: item.actual,
      absError: item.absError,
      rank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : 1,
      entries: Array.isArray(item.entries) ? item.entries : [],
    }));
  } catch {
    return [];
  }
}
