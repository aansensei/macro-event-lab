import type { Arena, ArenaScore, ArenaWindow, Contestant, ForecastInterval, TargetId } from "../data/arena";

export interface LeaderboardRow extends ArenaScore {
  contestantInfo: Contestant; rank: number | null; relative: number | null;
  // share of the contestant's total squared error that comes from its single worst period
  worstShare: number | null;
}

export function worstPeriodShare(arena: Arena, target: TargetId, contestant: string): number | null {
  const squares: number[] = [];
  for (const row of arena.forecasts) {
    const value = row.values[contestant];
    if (row.target !== target || row.actual === null || value === null || value === undefined) continue;
    squares.push((row.actual - value) ** 2);
  }
  const total = squares.reduce((sum, square) => sum + square, 0);
  return squares.length > 0 && total > 0 ? Math.max(...squares) / total : null;
}
export type ArenaSort = "rmse" | "mae" | "coverage_90" | "n" | "label";

export function relativeToNaive(rmse: number | null, naiveRmse: number | null): number | null {
  if (rmse === null || naiveRmse === null || !Number.isFinite(rmse) || !Number.isFinite(naiveRmse)
    || rmse < 0 || naiveRmse <= 0) return null;
  const relative = 100 * (rmse / naiveRmse - 1);
  return Number.isFinite(relative) ? relative : null;
}

export function leaderboardRows(arena: Arena, target: TargetId, window: ArenaWindow): LeaderboardRow[] {
  const scores = arena.scores.filter((score) => score.target === target && score.window === window);
  const naive = scores.find((score) => score.contestant === "naive")?.rmse ?? null;
  const ordered = [...scores].sort((a, b) => (a.rmse ?? Infinity) - (b.rmse ?? Infinity)
    || a.contestant.localeCompare(b.contestant));
  let rank = 0;
  return ordered.map((score, index) => {
    if (score.rmse !== null && (index === 0 || score.rmse !== ordered[index - 1]?.rmse)) rank = index + 1;
    return { ...score, contestantInfo: arena.contestants.find((entry) => entry.id === score.contestant)!,
      rank: score.rmse === null ? null : rank, relative: relativeToNaive(score.rmse, naive),
      worstShare: worstPeriodShare(arena, target, score.contestant) };
  });
}

export function sortLeaderboard(rows: LeaderboardRow[], sort: ArenaSort, direction: "asc" | "desc"): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "label") return (direction === "asc" ? 1 : -1) * a.contestantInfo.label.localeCompare(b.contestantInfo.label);
    const first = a[sort]; const second = b[sort];
    if (first === null) return second === null ? a.contestant.localeCompare(b.contestant) : 1;
    if (second === null) return -1;
    return (direction === "asc" ? first - second : second - first) || a.contestant.localeCompare(b.contestant);
  });
}

export function intervalCovered(actual: number | null, interval: ForecastInterval | null | undefined): boolean | null {
  if (actual === null || !Number.isFinite(actual) || !interval || interval.lo === null || interval.hi === null
    || !Number.isFinite(interval.lo) || !Number.isFinite(interval.hi) || interval.lo > interval.hi) return null;
  return interval.lo <= actual && actual <= interval.hi;
}

export function arenaRange(values: (number | null)[]): { maximum: number; clipped: boolean[] } {
  const sizes = values.filter((value): value is number => value !== null && Number.isFinite(value))
    .map(Math.abs).sort((a, b) => a - b);
  const cap = sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * 0.98))] ?? 0;
  const maximum = Math.max(0.1, cap * 1.15);
  return { maximum, clipped: values.map((value) => value !== null && Math.abs(value) > maximum) };
}
