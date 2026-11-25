# Forecast ledger

`ledger/forecast_ledger.jsonl` is an append-only JSON Lines log of live point forecasts recorded before official data releases. Each line is a single JSON object linked to the previous line by a SHA-256 hash chain, so any edit, deletion or reordering breaks verification.

## Row fields

| Field | Meaning |
| --- | --- |
| `sequence` | One-based integer position of the row in the ledger. |
| `forecast_id` | Deterministic identifier formatted as `fc_<YYYYMMDD>_<target>_<model_id>`. |
| `target` | Economic target (`gdp`, `cpi` or `payrolls`). |
| `reference_period` | Reference month or quarter start date (`YYYY-MM-01`). |
| `model_id` | Contestant identifier (`naive`, `ar`, `ridge`, `factor_ridge`, `lasso`, `spf`). |
| `point_forecast` | Recorded point forecast rounded to four decimal places. |
| `as_of` | Information date of the forecast (`YYYY-MM-DD`). |
| `recorded_at_utc` | UTC timestamp when the row was appended (`YYYY-MM-DDTHH:MM:SSZ`). |
| `prev_hash` | SHA-256 hex digest of the preceding row, or 64 zeros on row 1. |
| `entry_hash` | SHA-256 hex digest of the row's canonical JSON excluding `entry_hash`. |

## How to verify

From the repository root, run:

```bash
python -m macro_event_lab verify-ledger
```

To verify a specific file path, pass `--file`:

```bash
python -m macro_event_lab verify-ledger --file ledger/forecast_ledger.jsonl
```

The command exits 0 and prints `OK: <N> rows` when every genesis condition, `entry_hash`, `sequence` increment, `prev_hash` link and non-decreasing `recorded_at_utc` timestamp holds. It prints `PROBLEM` lines and exits 1 if any check fails.

## What a row proves

A row is only proof of what forecast value was recorded and when that commit was pushed to the public repository. Nothing in the ledger evaluates accuracy, and nothing in it ranks a contestant.
