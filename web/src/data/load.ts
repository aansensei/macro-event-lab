// Loads and checks the prebuilt JSON, so a bad or outdated file fails with a clear message
// instead of a broken chart.

import {
  SCHEMA_VERSION,
  type Bin,
  type EventFile,
  type Insight,
  type Manifest,
  type ManifestEvent,
  type Reaction,
  type SeriesSummary,
  type Snapshot,
  type Summary,
  type SummaryPoint,
  type SurvivalPoint,
} from "./types";

export class DataError extends Error {
  override name = "DataError";
}

type Json = Record<string, unknown>;

function obj(value: unknown, where: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DataError(`${where}: expected an object`);
  }
  return value as Json;
}

function str(o: Json, key: string, where: string): string {
  const v = o[key];
  if (typeof v !== "string") throw new DataError(`${where}.${key}: expected a string`);
  return v;
}

function strOrNull(o: Json, key: string, where: string): string | null {
  const v = o[key];
  if (v !== null && typeof v !== "string") {
    throw new DataError(`${where}.${key}: expected a string or null`);
  }
  return v;
}

function num(o: Json, key: string, where: string): number {
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new DataError(`${where}.${key}: expected a number`);
  }
  return v;
}

function numOrNull(o: Json, key: string, where: string): number | null {
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new DataError(`${where}.${key}: expected a number or null`);
  }
  return v;
}

function list(o: Json, key: string, where: string): unknown[] {
  const v = o[key];
  if (!Array.isArray(v)) throw new DataError(`${where}.${key}: expected a list`);
  return v;
}

function version(o: Json, where: string): number {
  const v = num(o, "schema_version", where);
  if (v !== SCHEMA_VERSION) {
    throw new DataError(`${where}: schema_version ${v}, this site reads ${SCHEMA_VERSION}`);
  }
  return v;
}

function finiteOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

function parseBin(value: unknown, where: string): Bin {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new DataError(`${where}: expected [lower, upper, probability]`);
  }
  const [lo, hi, p] = value;
  if (!finiteOrNull(lo) || !finiteOrNull(hi) || typeof p !== "number" || p < 0 || p > 1) {
    throw new DataError(`${where}: bounds must be numbers or null, probability in [0, 1]`);
  }
  return [lo, hi, p];
}

function parseSurvival(value: unknown, where: string): SurvivalPoint {
  if (
    !Array.isArray(value) || value.length !== 3 ||
    !value.every((x) => typeof x === "number" && Number.isFinite(x))
  ) {
    throw new DataError(`${where}: expected [strike, raw price, fitted]`);
  }
  return value as SurvivalPoint;
}

function parseSnapshot(value: unknown, where: string): Snapshot {
  const o = obj(value, where);
  return {
    h: num(o, "h", where),
    ts: str(o, "ts", where),
    mean: numOrNull(o, "mean", where),
    sd: numOrNull(o, "sd", where),
    p05: numOrNull(o, "p05", where),
    p25: numOrNull(o, "p25", where),
    p50: numOrNull(o, "p50", where),
    p75: numOrNull(o, "p75", where),
    p95: numOrNull(o, "p95", where),
    bins: list(o, "bins", where).map((b, i) => parseBin(b, `${where}.bins[${i}]`)),
    survival: list(o, "survival", where).map((s, i) =>
      parseSurvival(s, `${where}.survival[${i}]`),
    ),
  };
}

// files written before release-day reactions existed have no "reaction" key; that reads as none
function parseReaction(value: unknown, where: string): Reaction | null {
  if (value === undefined || value === null) return null;
  const o = obj(value, where);
  return {
    date: str(o, "date", where),
    prev_date: strOrNull(o, "prev_date", where),
    dgs2_bp: numOrNull(o, "dgs2_bp", where),
    dgs10_bp: numOrNull(o, "dgs10_bp", where),
  };
}

function boolOrNull(o: Json, key: string, where: string): boolean | null {
  const v = o[key];
  if (v !== null && typeof v !== "boolean") {
    throw new DataError(`${where}.${key}: expected true, false or null`);
  }
  return v;
}

// older files have no "insight" key; that reads as none
function parseInsight(value: unknown, where: string): Insight | null {
  if (value === undefined || value === null) return null;
  const o = obj(value, where);
  return {
    in_50: boolOrNull(o, "in_50", where),
    in_90: boolOrNull(o, "in_90", where),
    surprise_rank_pct: numOrNull(o, "surprise_rank_pct", where),
    series_n: num(o, "series_n", where),
    series_hit_50: numOrNull(o, "series_hit_50", where),
    series_hit_90: numOrNull(o, "series_hit_90", where),
    yield_n: numOrNull(o, "yield_n", where),
    dgs2_bp_per_sd: numOrNull(o, "dgs2_bp_per_sd", where),
    dgs10_bp_per_sd: numOrNull(o, "dgs10_bp_per_sd", where),
    dgs2_corr: numOrNull(o, "dgs2_corr", where),
    dgs10_corr: numOrNull(o, "dgs10_corr", where),
  };
}

function parseManifestEvent(value: unknown, where: string): ManifestEvent {
  const o = obj(value, where);
  return {
    id: str(o, "id", where),
    event_ticker: str(o, "event_ticker", where),
    series: str(o, "series", where),
    title: str(o, "title", where),
    unit: strOrNull(o, "unit", where),
    close: str(o, "close", where),
    release_date: strOrNull(o, "release_date", where),
    first_print: numOrNull(o, "first_print", where),
    surprise: numOrNull(o, "surprise", where),
    surprise_sd: numOrNull(o, "surprise_sd", where),
    file: str(o, "file", where),
    n_snapshots: num(o, "n_snapshots", where),
  };
}

export function parseManifest(value: unknown): Manifest {
  const o = obj(value, "manifest");
  return {
    schema_version: version(o, "manifest"),
    data_through: strOrNull(o, "data_through", "manifest"),
    events: list(o, "events", "manifest").map((e, i) =>
      parseManifestEvent(e, `manifest.events[${i}]`),
    ),
  };
}

export function parseEvent(value: unknown): EventFile {
  const o = obj(value, "event");
  const source = str(o, "first_print_source", "event");
  if (source !== "alfred" && source !== "kalshi") {
    throw new DataError(`event.first_print_source: unknown value "${source}"`);
  }
  const match = strOrNull(o, "match_method", "event");
  if (match !== null && match !== "reference_period" && match !== "release_window") {
    throw new DataError(`event.match_method: unknown value "${match}"`);
  }
  return {
    schema_version: version(o, "event"),
    id: str(o, "id", "event"),
    event_ticker: str(o, "event_ticker", "event"),
    series: str(o, "series", "event"),
    title: str(o, "title", "event"),
    unit: strOrNull(o, "unit", "event"),
    resolution: numOrNull(o, "resolution", "event"),
    close: str(o, "close", "event"),
    release_date: strOrNull(o, "release_date", "event"),
    reference_period: strOrNull(o, "reference_period", "event"),
    first_print: numOrNull(o, "first_print", "event"),
    first_print_source: source,
    match_method: match,
    settled_value: numOrNull(o, "settled_value", "event"),
    surprise: numOrNull(o, "surprise", "event"),
    surprise_sd: numOrNull(o, "surprise_sd", "event"),
    reaction: parseReaction(o.reaction, "event.reaction"),
    insight: parseInsight(o.insight, "event.insight"),
    snapshots: list(o, "snapshots", "event").map((s, i) =>
      parseSnapshot(s, `event.snapshots[${i}]`),
    ),
  };
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url);
  } catch (err) {
    throw new DataError(`Could not reach ${url}: ${(err as Error).message}`);
  }
  if (!response.ok) throw new DataError(`Could not load ${url} (HTTP ${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new DataError(`${url} is not valid JSON`);
  }
}

// base is the folder holding manifest.json, relative to the page ("data/" in production)
export async function loadManifest(base = "data/", fetchImpl: typeof fetch = fetch) {
  return parseManifest(await fetchJson(`${base}manifest.json`, fetchImpl));
}

export async function loadEvent(
  entry: ManifestEvent, base = "data/", fetchImpl: typeof fetch = fetch,
) {
  return parseEvent(await fetchJson(`${base}${entry.file}`, fetchImpl));
}

function parseSeriesSummary(value: unknown, where: string): SeriesSummary {
  const o = obj(value, where);
  return {
    series: str(o, "series", where),
    label: str(o, "label", where),
    n: num(o, "n", where),
    yield_n: numOrNull(o, "yield_n", where),
    hit_50: numOrNull(o, "hit_50", where),
    hit_90: numOrNull(o, "hit_90", where),
    dgs2_bp_per_sd: numOrNull(o, "dgs2_bp_per_sd", where),
    dgs10_bp_per_sd: numOrNull(o, "dgs10_bp_per_sd", where),
    dgs2_corr: numOrNull(o, "dgs2_corr", where),
    dgs10_corr: numOrNull(o, "dgs10_corr", where),
    mean_abs_sd: numOrNull(o, "mean_abs_sd", where),
  };
}

function parseSummaryPoint(value: unknown, where: string): SummaryPoint {
  const o = obj(value, where);
  return {
    id: str(o, "id", where),
    series: str(o, "series", where),
    title: str(o, "title", where),
    surprise_sd: num(o, "surprise_sd", where),
    dgs2_bp: numOrNull(o, "dgs2_bp", where),
    dgs10_bp: numOrNull(o, "dgs10_bp", where),
    in_50: boolOrNull(o, "in_50", where),
    in_90: boolOrNull(o, "in_90", where),
  };
}

export function parseSummary(value: unknown): Summary {
  const o = obj(value, "summary");
  return {
    schema_version: version(o, "summary"),
    series: list(o, "series", "summary").map((s, i) => parseSeriesSummary(s, `summary.series[${i}]`)),
    points: list(o, "points", "summary").map((p, i) => parseSummaryPoint(p, `summary.points[${i}]`)),
  };
}

export async function loadSummary(base = "data/", fetchImpl: typeof fetch = fetch) {
  return parseSummary(await fetchJson(`${base}summary.json`, fetchImpl));
}
