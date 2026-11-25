import type { TargetId } from "./arena";
import { arrayValue, countValue, dateValue, fetchPublicJson, objectValue, textValue, uniqueValues } from "./publicData";

export interface TrackRow {
  target: TargetId; reference_period: string; model_id: string; forecast: number; actual: number;
  abs_error: number; as_of: string; recorded_at_utc: string; release_date: string; sequence: number;
}
export interface TrackSummary {
  target: TargetId; model_id: string; n: number; mae: number; rmse: number; beat_naive: number | null;
}
export interface LedgerTrack {
  schema_version: 1; scored: TrackRow[]; summary: TrackSummary[]; late: number; ledger_rows: number;
  pending: { target: TargetId; reference_period: string; rows: number }[];
}

function targetId(value: unknown): TargetId {
  if (value !== "gdp" && value !== "cpi" && value !== "payrolls") throw new Error("Unknown track record target.");
  return value;
}

function finite(value: unknown, nonnegative = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (nonnegative && value < 0)) throw new Error("Invalid track record number.");
  return value;
}

export function parseLedgerTrack(value: unknown): LedgerTrack {
  const root = objectValue(value, "Track record");
  if (root.schema_version !== 1) throw new Error("Unsupported track record version.");
  const scored = arrayValue(root.scored, "Scored forecasts").map((raw): TrackRow => {
    const row = objectValue(raw, "Scored forecast");
    const recorded = textValue(row.recorded_at_utc, "Record time");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(recorded) || !Number.isFinite(Date.parse(recorded))) throw new Error("Invalid track record timestamp.");
    const release = dateValue(row.release_date, "Release date");
    if (dateValue(recorded.slice(0, 10), "Record date") >= release) throw new Error("Track record includes a late forecast.");
    return { target: targetId(row.target), reference_period: dateValue(row.reference_period, "Period"),
      model_id: textValue(row.model_id, "Model"), forecast: finite(row.forecast), actual: finite(row.actual),
      abs_error: finite(row.abs_error, true), as_of: dateValue(row.as_of, "Information date"),
      recorded_at_utc: recorded, release_date: release, sequence: countValue(row.sequence, "Sequence") };
  });
  const summary = arrayValue(root.summary, "Track summary").map((raw): TrackSummary => {
    const row = objectValue(raw, "Track summary row");
    const n = countValue(row.n, "Release count");
    const beat = row.beat_naive === null ? null : countValue(row.beat_naive, "Beat naive count");
    if (beat !== null && beat > n) throw new Error("Beat naive count exceeds releases scored.");
    return { target: targetId(row.target), model_id: textValue(row.model_id, "Model"), n,
      mae: finite(row.mae, true), rmse: finite(row.rmse, true), beat_naive: beat };
  });
  const pending = arrayValue(root.pending, "Pending releases").map((raw) => {
    const row = objectValue(raw, "Pending release");
    return { target: targetId(row.target), reference_period: dateValue(row.reference_period, "Period"), rows: countValue(row.rows, "Pending forecasts") };
  });
  uniqueValues(scored.map((row) => String(row.sequence)), "Scored sequences");
  uniqueValues(summary.map((row) => `${row.target}:${row.model_id}`), "Track summary");
  uniqueValues(pending.map((row) => `${row.target}:${row.reference_period}`), "Pending releases");
  const late = countValue(root.late, "Late forecasts");
  const ledgerRows = countValue(root.ledger_rows, "Ledger rows");
  if (scored.length + late + pending.reduce((n, row) => n + row.rows, 0) !== ledgerRows) throw new Error("Track record counts do not match the ledger.");
  return { schema_version: 1, scored, summary, pending, late, ledger_rows: ledgerRows };
}

export async function loadLedgerTrack(fetchImpl: typeof fetch = fetch): Promise<LedgerTrack> {
  return parseLedgerTrack(await fetchPublicJson("ledger_track", "The track record has not been built yet.", fetchImpl));
}
