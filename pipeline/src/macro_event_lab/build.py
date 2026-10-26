"""Silver layer: rebuild clean Parquet tables from the raw store.

`build` always re-parses everything from raw, so it is deterministic and idempotent:
running it twice gives the same tables, and a parser fix only needs a rebuild, not a re-download.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.raw_store import iter_manifest, load_raw
from macro_event_lab.sources import alfred, kalshi

UTC_TS = pl.Datetime("us", "UTC")

# Fixed column types, so a column that happens to be all null (e.g. cap_strike for a series
# with only "greater" contracts) is still written as its real type instead of Null.
ALFRED_SCHEMA = {
    "series_id": pl.String,
    "observation_date": pl.Date,
    "value": pl.Float64,
    "realtime_start": pl.Date,
    "realtime_end": pl.Date,
    "fetched_at_utc": pl.String,
}
MARKET_SCHEMA = {
    "ticker": pl.String,
    "event_ticker": pl.String,
    "series_ticker": pl.String,
    "title": pl.String,
    "strike_type": pl.String,
    "floor_strike": pl.Float64,
    "cap_strike": pl.Float64,
    "status": pl.String,
    "result": pl.String,
    "expiration_value": pl.String,
    "open_time": UTC_TS,
    "close_time": UTC_TS,
    "settlement_ts": UTC_TS,
    "fetched_at_utc": pl.String,
}
CANDLE_SCHEMA = {
    "ticker": pl.String,
    "end_period_ts": UTC_TS,
    "yes_bid_close": pl.Float64,
    "yes_ask_close": pl.Float64,
    "price_close": pl.Float64,
    "price_mean": pl.Float64,
    "volume": pl.Float64,
    "open_interest": pl.Float64,
    "fetched_at_utc": pl.String,
}


def _latest_first(records):
    return sorted(records, key=lambda r: r.fetched_at_utc, reverse=True)


def build_silver(paths: Paths) -> dict[str, int]:
    alfred_rows: list[dict] = []
    market_rows: list[dict] = []
    candle_rows: list[dict] = []

    # Newest fetch first, so `unique(keep="first")` keeps the latest copy of each key.
    for record in _latest_first(iter_manifest(paths.raw)):
        payload = load_raw(paths.raw, record)
        fetched = record.fetched_at_utc
        if record.kind == alfred.KIND:
            rows = alfred.parse_observations(record.meta["series_id"], payload)
        elif record.kind in {"kalshi.markets", "kalshi.historical_markets"}:
            rows = kalshi.parse_markets(record.meta["series_ticker"], payload)
            market_rows += [{**r, "fetched_at_utc": fetched} for r in rows]
            continue
        elif record.kind in {"kalshi.candles", "kalshi.historical_candles"}:
            rows = kalshi.parse_candles(payload)
            candle_rows += [{**r, "fetched_at_utc": fetched} for r in rows]
            continue
        else:
            continue
        alfred_rows += [{**r, "fetched_at_utc": fetched} for r in rows]

    paths.silver.mkdir(parents=True, exist_ok=True)
    counts = {}
    counts["alfred_observations"] = _write(
        alfred_rows,
        ALFRED_SCHEMA,
        keys=["series_id", "observation_date", "realtime_start"],
        sort=["series_id", "observation_date", "realtime_start"],
        out=paths.silver / "alfred_observations.parquet",
    )
    counts["kalshi_markets"] = _write(
        market_rows,
        MARKET_SCHEMA,
        keys=["ticker"],
        sort=["series_ticker", "event_ticker", "ticker"],
        out=paths.silver / "kalshi_markets.parquet",
    )
    counts["kalshi_candles"] = _write(
        candle_rows,
        CANDLE_SCHEMA,
        keys=["ticker", "end_period_ts"],
        sort=["ticker", "end_period_ts"],
        out=paths.silver / "kalshi_candles.parquet",
    )
    return counts


def _write(
    rows: list[dict], schema: dict[str, pl.DataType], keys: list[str], sort: list[str], out: Path
) -> int:
    if not rows:
        return 0
    df = (
        pl.DataFrame(rows, schema=schema)
        .unique(subset=keys, keep="first", maintain_order=True)
        .sort(sort)
    )
    df.write_parquet(out, compression="zstd")
    return df.height
