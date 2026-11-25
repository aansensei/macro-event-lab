declare const __OPEN_DATA_SIZES__: Record<string, number> | undefined;

export const OPEN_DATA_SIZES: Record<string, number> =
  typeof __OPEN_DATA_SIZES__ !== "undefined" ? __OPEN_DATA_SIZES__ : {};

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "Pending build";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface OpenDataColumn {
  name: string;
  meaning: string;
}

export interface OpenDataFile {
  parquet: string;
  file: string;
  title: string;
  description: string;
  columns: OpenDataColumn[];
}

export const OPEN_DATA_FILES: {
  parquet: string;
  file: string;
  title: string;
  description: string;
  columns: { name: string; meaning: string }[];
}[] = [
  {
    parquet: "arena_forecasts.parquet",
    file: "arena_forecasts.csv",
    title: "Arena forecasts",
    description: "One row per target period and contestant with a recorded forecast, paired with the first published number and 90% interval bounds when available.",
    columns: [
      { name: "target", meaning: "Target series identifier: gdp, cpi, or payrolls." },
      { name: "period", meaning: "Reference period start date in ISO date format." },
      { name: "made_on", meaning: "Information cutoff date when the forecast was recorded in ISO date format." },
      { name: "contestant_id", meaning: "Short identifier of the forecaster or model." },
      { name: "contestant", meaning: "Display name of the forecaster or model." },
      { name: "kind", meaning: "Contestant group: baseline, classical, foundation, or human." },
      { name: "forecast", meaning: "Point forecast in target units: annualized percent q/q for GDP, percent m/m for CPI, or thousands of jobs for payrolls." },
      { name: "first_print", meaning: "First published actual value in target units: annualized percent q/q for GDP, percent m/m for CPI, or thousands of jobs for payrolls." },
      { name: "interval_lo", meaning: "Lower bound of the 90% forecast interval in target units: annualized percent q/q for GDP, percent m/m for CPI, or thousands of jobs for payrolls." },
      { name: "interval_hi", meaning: "Upper bound of the 90% forecast interval in target units: annualized percent q/q for GDP, percent m/m for CPI, or thousands of jobs for payrolls." },
      { name: "error", meaning: "Forecast error (first print minus forecast) in percentage points for GDP or CPI, or thousands of jobs for payrolls." },
    ],
  },
  {
    parquet: "arena_scores.parquet",
    file: "arena_scores.csv",
    title: "Arena summary scores",
    description: "Summary accuracy and interval coverage metrics across evaluated periods for each target, contestant, and evaluation window.",
    columns: [
      { name: "target", meaning: "Target series identifier: gdp, cpi, or payrolls." },
      { name: "contestant_id", meaning: "Short identifier of the forecaster or model." },
      { name: "contestant", meaning: "Display name of the forecaster or model." },
      { name: "window", meaning: "Evaluation window: all periods or clean periods after the training cutoff." },
      { name: "n", meaning: "Count of evaluated periods." },
      { name: "mae", meaning: "Mean absolute error in percentage points for GDP or CPI, or thousands of jobs for payrolls." },
      { name: "rmse", meaning: "Root mean squared error in percentage points for GDP or CPI, or thousands of jobs for payrolls." },
      { name: "coverage_90", meaning: "Share of evaluated periods inside the 90% interval, from 0 to 1." },
      { name: "dm_vs_naive_p", meaning: "Two sided Diebold Mariano p value against the naive baseline, from 0 to 1." },
    ],
  },
  {
    parquet: "revisions.parquet",
    file: "revisions.csv",
    title: "Macro data revisions",
    description: "First published, next release, and latest vintage values for each reference period in CPI, Jobs, and GDP.",
    columns: [
      { name: "series", meaning: "Series identifier: cpi, payrolls, or gdp." },
      { name: "label", meaning: "Short series label: CPI, Jobs, or GDP." },
      { name: "unit", meaning: "Published unit for the series: % m/m for CPI, jobs for Jobs, or % annualized for GDP." },
      { name: "period", meaning: "Reference period start date in ISO date format." },
      { name: "first_print", meaning: "First published value in the series unit: % m/m percent, jobs, or % annualized percent." },
      { name: "next_print", meaning: "Value published one release later in the series unit: % m/m percent, jobs, or % annualized percent." },
      { name: "latest", meaning: "Latest available vintage value in the series unit: % m/m percent, jobs, or % annualized percent." },
      { name: "settled", meaning: "Whether at least 24 months separate the period from the latest vintage: true or false." },
    ],
  },
];
