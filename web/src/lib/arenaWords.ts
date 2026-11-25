import type { ArenaForecast, ArenaTarget, Contestant } from "../data/arena";
import { periodLabel } from "./revisionWords";

export const ARENA_GUIDE = "RMSE is the square root of the average squared forecast error. MAE is the average absolute error. Both use the target's displayed units. Coverage is the share of published first prints inside a supplied 90 percent interval. Missing values mean unavailable, never zero.";

export function arenaValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not available" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function arenaCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not available" : value.toLocaleString("en-US");
}

// the data file rounds p values to 4 decimals, so an exact zero means smaller than 0.0001
export function arenaPValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Not available";
  return value === 0 ? "less than 0.0001" : value.toPrecision(3);
}

export function coveragePercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not available" : `${(100 * value).toFixed(1)}%`;
}

export function coverageIntervalNote(
  lo: number | null | undefined,
  hi: number | null | undefined,
  count: number | null | undefined,
): string | null {
  if (lo === null || lo === undefined || hi === null || hi === undefined || count === null || count === undefined) return null;
  return `95% interval ${(100 * lo).toFixed(0)}% to ${(100 * hi).toFixed(0)}%, ${count.toLocaleString("en-US")} ${count === 1 ? "forecast" : "forecasts"}`;
}

export function contestantKind(kind: Contestant["kind"]): string {
  return { baseline: "Baseline", classical: "Classical", foundation: "Foundation", human: "Human" }[kind];
}

export function forecastReadout(point: ArenaForecast, target: ArenaTarget, contestant: Contestant | undefined): string {
  const interval = contestant ? point.intervals[contestant.id] : null;
  const band = interval?.lo !== null && interval?.hi !== null && interval
    ? `90 percent interval ${arenaValue(interval.lo)} to ${arenaValue(interval.hi)}` : "90 percent interval not available";
  return `${periodLabel(target.id, point.period)}. Cutoff ${point.made_on}. First print ${arenaValue(point.actual)}. ${contestant?.label ?? "Forecast"} ${arenaValue(contestant ? point.values[contestant.id] : null)}. ${band}. Units: ${target.unit}.`;
}
