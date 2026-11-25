import { arrayValue, countValue, dateValue, fetchPublicJson, objectValue, textValue, uniqueValues } from "./publicData";

export type TargetId = "gdp" | "cpi" | "payrolls";
export type ArenaWindow = "all" | "clean";
export const ARENA_NOT_BUILT = "The arena has not been built yet";
export interface ArenaTarget { id: TargetId; label: string; unit: string; frequency: "quarterly" | "monthly" }
export interface Contestant { id: string; label: string; kind: "baseline" | "classical" | "foundation" | "human"; note: string }
export interface ForecastInterval { level: 0.9; lo: number | null; hi: number | null }
export interface ArenaForecast {
  target: TargetId; period: string; made_on: string; actual: number | null;
  values: Record<string, number | null>; intervals: Record<string, ForecastInterval | null>;
}
export interface ArenaScore {
  target: TargetId; contestant: string; window: ArenaWindow; n: number;
  mae: number | null; rmse: number | null; coverage_90: number | null; dm_vs_naive_p: number | null;
  n_intervals?: number | null; coverage_90_lo?: number | null; coverage_90_hi?: number | null;
  pinball_05?: number | null; pinball_50?: number | null; pinball_95?: number | null;
  aci_n?: number | null; aci_coverage_90?: number | null;
}
export interface NestedTest {
  target: TargetId; restricted: string; larger: string; window: ArenaWindow;
  n: number; statistic: number | null; p_value: number | null;
}
export interface ParsedArenaScore extends ArenaScore {
  n_intervals: number | null; coverage_90_lo: number | null; coverage_90_hi: number | null;
  pinball_05: number | null; pinball_50: number | null; pinball_95: number | null;
  aci_n: number | null; aci_coverage_90: number | null;
}
export interface LeakageRow {
  contestant: string; cutoff_rule: "published" | "weights_release_date" | "none"; cutoff: string | null;
  n_before: number; n_after: number; rmse_before: number | null; rmse_after: number | null;
}
export interface LiveForecastRow { target: TargetId; period: string; as_of: string; values: Record<string, number | null> }
export interface Arena {
  schema_version: 1; information_date: string; targets: ArenaTarget[]; contestants: Contestant[];
  forecasts: ArenaForecast[]; scores: ArenaScore[]; leakage: LeakageRow[]; live: LiveForecastRow[];
  nested_tests?: NestedTest[];
}
export interface ParsedArena extends Arena {
  scores: ParsedArenaScore[];
  nested_tests: NestedTest[];
}

function nullableNumber(value: unknown, where: string, maximum = Infinity, minimum = -Infinity): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${where}: invalid numeric value.`);
  }
  return value;
}

function optionalNullableNumber(value: unknown, where: string, maximum = Infinity, minimum = -Infinity): number | null {
  return value === undefined ? null : nullableNumber(value, where, maximum, minimum);
}

function optionalNullableCount(value: unknown, where: string): number | null {
  return value === undefined || value === null ? null : countValue(value, where);
}

export function parseArena(value: unknown): ParsedArena {
  const root = objectValue(value, "Arena");
  if (root.schema_version !== 1) throw new Error("Unsupported arena data version. This page reads version 1.");
  const informationDate = dateValue(root.information_date, "Information date");
  const targets = arrayValue(root.targets, "Targets").map((raw): ArenaTarget => {
    const target = objectValue(raw, "Target");
    if (target.id !== "gdp" && target.id !== "cpi" && target.id !== "payrolls") throw new Error("Unknown economic target.");
    if (target.frequency !== "quarterly" && target.frequency !== "monthly") throw new Error("Unknown target frequency.");
    return { id: target.id, label: textValue(target.label, "Target label"), unit: textValue(target.unit, "Target unit"), frequency: target.frequency };
  });
  const contestants = arrayValue(root.contestants, "Contestants").map((raw): Contestant => {
    const contestant = objectValue(raw, "Contestant");
    if (contestant.kind !== "baseline" && contestant.kind !== "classical"
      && contestant.kind !== "foundation" && contestant.kind !== "human") throw new Error("Unknown contestant kind.");
    if (typeof contestant.note !== "string") throw new Error("Contestant note must be text.");
    return { id: textValue(contestant.id, "Contestant ID"), label: textValue(contestant.label, "Contestant label"), kind: contestant.kind, note: contestant.note };
  });
  uniqueValues(targets.map((target) => target.id), "Targets");
  uniqueValues(contestants.map((contestant) => contestant.id), "Contestants");
  const targetIds = new Set(targets.map((target) => target.id));
  const contestantIds = new Set(contestants.map((contestant) => contestant.id));

  function targetReference(raw: unknown): TargetId {
    if ((raw !== "gdp" && raw !== "cpi" && raw !== "payrolls") || !targetIds.has(raw)) throw new Error("Record refers to an undeclared target.");
    return raw;
  }
  function contestantReference(raw: unknown): string {
    const id = textValue(raw, "Contestant reference");
    if (!contestantIds.has(id)) throw new Error("Record refers to an undeclared contestant.");
    return id;
  }
  function periodValue(raw: unknown): string {
    const period = dateValue(raw, "Reference period");
    if (!period.endsWith("-01")) throw new Error("Reference periods must start on the first day of a month.");
    return period;
  }
  function originValue(raw: unknown): string {
    const origin = dateValue(raw, "Forecast cutoff");
    if (origin > informationDate) throw new Error("Forecast cutoff is after the information date.");
    return origin;
  }
  function forecastValues(raw: unknown): Record<string, number | null> {
    return Object.fromEntries(Object.entries(objectValue(raw, "Forecast values")).map(([key, number]): [string, number | null] =>
      [contestantReference(key), nullableNumber(number, "Forecast value")],
    ));
  }
  const forecasts = arrayValue(root.forecasts, "Forecasts").map((raw): ArenaForecast => {
    const forecast = objectValue(raw, "Forecast");
    const intervals = Object.fromEntries(Object.entries(objectValue(forecast.intervals, "Intervals")).map(([id, raw]): [string, ForecastInterval | null] => {
      contestantReference(id);
      if (raw === null) return [id, null];
      const interval = objectValue(raw, "Interval");
      if (interval.level !== 0.9) throw new Error("Expected a 90 percent interval.");
      const lo = nullableNumber(interval.lo, "Lower interval bound");
      const hi = nullableNumber(interval.hi, "Upper interval bound");
      if (lo !== null && hi !== null && lo > hi) throw new Error("Interval bounds are reversed.");
      return [id, { level: 0.9 as const, lo, hi }];
    }));
    return { target: targetReference(forecast.target), period: periodValue(forecast.period),
      made_on: originValue(forecast.made_on), actual: nullableNumber(forecast.actual, "First print"),
      values: forecastValues(forecast.values), intervals };
  });
  const scores = arrayValue(root.scores, "Scores").map((raw): ParsedArenaScore => {
    const score = objectValue(raw, "Score");
    if (score.window !== "all" && score.window !== "clean") throw new Error("Unknown evaluation window.");
    return { target: targetReference(score.target), contestant: contestantReference(score.contestant), window: score.window,
      n: countValue(score.n, "Scored period count"), mae: nullableNumber(score.mae, "MAE", Infinity, 0),
      rmse: nullableNumber(score.rmse, "RMSE", Infinity, 0), coverage_90: nullableNumber(score.coverage_90, "Coverage", 1, 0),
      dm_vs_naive_p: nullableNumber(score.dm_vs_naive_p, "P value", 1, 0),
      n_intervals: optionalNullableCount(score.n_intervals, "Interval count"),
      coverage_90_lo: optionalNullableNumber(score.coverage_90_lo, "Coverage lower bound", 1, 0),
      coverage_90_hi: optionalNullableNumber(score.coverage_90_hi, "Coverage upper bound", 1, 0),
      pinball_05: optionalNullableNumber(score.pinball_05, "Pinball 5% loss", Infinity, 0),
      pinball_50: optionalNullableNumber(score.pinball_50, "Pinball 50% loss", Infinity, 0),
      pinball_95: optionalNullableNumber(score.pinball_95, "Pinball 95% loss", Infinity, 0),
      aci_n: optionalNullableCount(score.aci_n, "Adaptive coverage count"),
      aci_coverage_90: optionalNullableNumber(score.aci_coverage_90, "Adaptive coverage", 1, 0) };
  });
  const nestedTests = root.nested_tests === undefined ? [] : arrayValue(root.nested_tests, "Nested tests").map((raw): NestedTest => {
    const row = objectValue(raw, "Nested test");
    if (row.window !== "all" && row.window !== "clean") throw new Error("Unknown evaluation window.");
    return {
      target: targetReference(row.target),
      restricted: contestantReference(row.restricted),
      larger: contestantReference(row.larger),
      window: row.window,
      n: countValue(row.n, "Nested test period count"),
      statistic: nullableNumber(row.statistic, "Nested test statistic"),
      p_value: nullableNumber(row.p_value, "Nested test p value", 1, 0),
    };
  });
  const leakage = arrayValue(root.leakage, "Leakage audit").map((raw): LeakageRow => {
    const row = objectValue(raw, "Audit row");
    if (row.cutoff_rule !== "published" && row.cutoff_rule !== "weights_release_date" && row.cutoff_rule !== "none") throw new Error("Unknown cutoff rule.");
    const cutoff = row.cutoff === null ? null : dateValue(row.cutoff, "Training cutoff");
    if (row.cutoff_rule !== "none" && cutoff === null) throw new Error("Training cutoff date is missing.");
    return { contestant: contestantReference(row.contestant), cutoff_rule: row.cutoff_rule, cutoff,
      n_before: countValue(row.n_before, "Before count"), n_after: countValue(row.n_after, "After count"),
      rmse_before: nullableNumber(row.rmse_before, "Before error", Infinity, 0), rmse_after: nullableNumber(row.rmse_after, "After error", Infinity, 0) };
  });
  const live = arrayValue(root.live, "Live forecasts").map((raw): LiveForecastRow => {
    const row = objectValue(raw, "Live forecast");
    return { target: targetReference(row.target), period: periodValue(row.period), as_of: originValue(row.as_of), values: forecastValues(row.values) };
  });
  uniqueValues(forecasts.map((row) => `${row.target}:${row.period}`), "Forecasts");
  uniqueValues(scores.map((row) => `${row.target}:${row.contestant}:${row.window}`), "Scores");
  uniqueValues(nestedTests.map((row) => `${row.target}:${row.restricted}:${row.larger}:${row.window}`), "Nested tests");
  uniqueValues(leakage.map((row) => row.contestant), "Audit rows");
  uniqueValues(live.map((row) => `${row.target}:${row.period}:${row.as_of}`), "Live forecasts");
  return { schema_version: 1, information_date: informationDate, targets, contestants,
    forecasts: forecasts.sort((a, b) => a.period.localeCompare(b.period)), scores, leakage, live, nested_tests: nestedTests };
}

export async function loadArena(fetchImpl: typeof fetch = fetch): Promise<Arena> {
  return parseArena(await fetchPublicJson("arena", ARENA_NOT_BUILT, fetchImpl));
}
