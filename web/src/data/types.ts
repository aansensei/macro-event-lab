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

// change in the 2 and 10 year Treasury yields on the release day, in basis points
export interface Reaction {
  date: string;
  prev_date: string | null;
  dgs2_bp: number | null;
  dgs10_bp: number | null;
}

// this event set against every other event of its series (pipeline gold.event_insights)
export interface Insight {
  in_50: boolean | null;
  in_90: boolean | null;
  // share of the series' other events with a smaller absolute surprise, 0 to 1
  surprise_rank_pct: number | null;
  series_n: number;
  series_hit_50: number | null;
  series_hit_90: number | null;
  yield_n: number | null;
  dgs2_bp_per_sd: number | null;
  dgs10_bp_per_sd: number | null;
  dgs2_corr: number | null;
  dgs10_corr: number | null;
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
  reaction: Reaction | null;
  insight: Insight | null;
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
