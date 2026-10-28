// Shapes of the JSON the pipeline writes to data/web (pipeline/src/macro_event_lab/web_export.py).

export const SCHEMA_VERSION = 1;

// [lower, upper, probability]; null marks an open end of the outcome range
export type Bin = [lower: number | null, upper: number | null, prob: number];

// [strike k, raw contract price, isotonic P(X > k)]
export type SurvivalPoint = [strike: number, rawPrice: number, fitted: number];

export interface Snapshot {
  h: number;
  ts: string;
  mean: number | null;
  sd: number | null;
  p05: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  bins: Bin[];
  survival: SurvivalPoint[];
}

export type FirstPrintSource = "alfred" | "kalshi";
export type MatchMethod = "reference_period" | "release_window";

export interface EventFile {
  schema_version: number;
  id: string;
  event_ticker: string;
  series: string;
  title: string;
  unit: string | null;
  resolution: number | null;
  close: string;
  release_date: string | null;
  reference_period: string | null;
  first_print: number | null;
  first_print_source: FirstPrintSource;
  match_method: MatchMethod | null;
  settled_value: number | null;
  surprise: number | null;
  surprise_sd: number | null;
  snapshots: Snapshot[];
}

export interface ManifestEvent {
  id: string;
  event_ticker: string;
  series: string;
  title: string;
  unit: string | null;
  close: string;
  release_date: string | null;
  first_print: number | null;
  surprise: number | null;
  surprise_sd: number | null;
  file: string;
  n_snapshots: number;
}

export interface Manifest {
  schema_version: number;
  data_through: string | null;
  events: ManifestEvent[];
}
