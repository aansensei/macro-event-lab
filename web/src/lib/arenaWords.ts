import type { ArenaForecast, ArenaTarget, Contestant } from "../data/arena";
import { periodLabel } from "./revisionWords";

export const ARENA_GUIDE = "RMSE is the square root of the average squared forecast error. MAE is the average absolute error. Both use the target's displayed units. Coverage is the share of published first prints inside a supplied 90 percent interval. Missing values mean unavailable, never zero.";

export function arenaValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not available" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
