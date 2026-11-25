import type { TargetId } from "./arena";
import { arrayValue, countValue, dateValue, fetchPublicJson, objectValue, textValue, uniqueValues } from "./publicData";

export const REACTIONS_NOT_BUILT = "The release reactions data has not been built yet.";

export interface ReactionRow {
  target: TargetId;
  period: string;
  release_date: string;
  first_print: number;
  benchmark: number;
  benchmark_kind: "survey" | "models";
  surprise: number;
  d2y_bp: number;
  d10y_bp: number;
}

export interface ReactionSummary {
  target: TargetId;
  n: number;
  corr_2y: number | null;
  corr_10y: number | null;
  slope_10y_bp_per_unit: number | null;
  p_10y: number | null;
}

export interface ReactionsData {
  schema_version: 1;
  rows: ReactionRow[];
  summary: ReactionSummary[];
  units: Partial<Record<TargetId, string>>;
}

function targetId(value: unknown, where: string): TargetId {
  if (value !== "gdp" && value !== "cpi" && value !== "payrolls") {
    throw new Error(`${where}: expected gdp, cpi or payrolls.`);
  }
  return value;
}

function finiteNumber(value: unknown, where: string, minimum = -Infinity, maximum = Infinity): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${where}: invalid numeric value.`);
  }
  return value;
}

function nullableNumber(value: unknown, where: string, minimum = -Infinity, maximum = Infinity): number | null {
  if (value === null) return null;
  return finiteNumber(value, where, minimum, maximum);
}

export function parseReactions(value: unknown): ReactionsData {
  const root = objectValue(value, "Reactions");
  if (root.schema_version !== 1) {
    throw new Error("Unsupported reactions data version. This page reads version 1.");
  }

  const rawUnits = objectValue(root.units, "Reaction units");
  const units: Partial<Record<TargetId, string>> = {};
  for (const [key, unitVal] of Object.entries(rawUnits)) {
    const id = targetId(key, "Reaction unit target");
    units[id] = textValue(unitVal, `Reaction unit for ${id}`);
  }

  const rows = arrayValue(root.rows, "Reaction rows").map((raw): ReactionRow => {
    const row = objectValue(raw, "Reaction row");
    const target = targetId(row.target, "Reaction row target");
    if (!units[target]) throw new Error(`Reaction unit missing for ${target}.`);
    if (row.benchmark_kind !== "survey" && row.benchmark_kind !== "models") {
      throw new Error("Reaction benchmark kind must be survey or models.");
    }
    return {
      target,
      period: dateValue(row.period, "Reaction period"),
      release_date: dateValue(row.release_date, "Reaction release date"),
      first_print: finiteNumber(row.first_print, "First print"),
      benchmark: finiteNumber(row.benchmark, "Benchmark"),
      benchmark_kind: row.benchmark_kind,
      surprise: finiteNumber(row.surprise, "Surprise"),
      d2y_bp: finiteNumber(row.d2y_bp, "2-year yield change"),
      d10y_bp: finiteNumber(row.d10y_bp, "10-year yield change"),
    };
  });

  const summary = arrayValue(root.summary, "Reaction summary").map((raw): ReactionSummary => {
    const item = objectValue(raw, "Reaction summary row");
    const target = targetId(item.target, "Reaction summary target");
    if (!units[target]) throw new Error(`Reaction unit missing for ${target}.`);
    return {
      target,
      n: countValue(item.n, "Reaction summary count"),
      corr_2y: nullableNumber(item.corr_2y, "2-year correlation", -1, 1),
      corr_10y: nullableNumber(item.corr_10y, "10-year correlation", -1, 1),
      slope_10y_bp_per_unit: nullableNumber(item.slope_10y_bp_per_unit, "10-year slope"),
      p_10y: nullableNumber(item.p_10y, "10-year p value", 0, 1),
    };
  });

  uniqueValues(rows.map((row) => `${row.target}:${row.period}`), "Reaction rows");
  uniqueValues(summary.map((item) => item.target), "Reaction summary");
  return { schema_version: 1, rows, summary, units };
}

export async function loadReactions(fetchImpl: typeof fetch = fetch): Promise<ReactionsData> {
  return parseReactions(await fetchPublicJson("reactions", REACTIONS_NOT_BUILT, fetchImpl));
}
