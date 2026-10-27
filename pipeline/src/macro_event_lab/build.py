"""Silver layer: rebuild clean Parquet tables from the raw store.

`build` always re-parses everything from raw, so it is deterministic and idempotent:
running it twice gives the same tables, and a parser fix only needs a rebuild, not a re-download.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

from macro_event_lab.config import RELEASES, Paths
from macro_event_lab.pit import attach_known_from
from macro_event_lab.raw_store import iter_manifest, load_raw
from macro_event_lab.sources import alfred, kalshi, releases

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
    "strike_source": pl.String,
    "status": pl.String,
    "result": pl.String,
    "expiration_value": pl.String,
    "open_time": UTC_TS,
    "close_time": UTC_TS,
    "settlement_ts": UTC_TS,
    "fetched_at_utc": pl.String,
}
CALENDAR_SCHEMA = {
    "release": pl.String,
    "release_date": pl.Date,
    "release_ts": UTC_TS,
    "source": pl.String,
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
    calendar_rows: list[dict] = releases.calendar_rows(
        "fomc", releases.fomc_statement_dates(), "seed:fomc_meetings.csv"
    )
    calendar_pages_seen: set[tuple[str, int]] = set()

    # Newest fetch first, so `unique(keep="first")` keeps the latest copy of each key.
    for record in _latest_first(iter_manifest(paths.raw)):
        payload = load_raw(paths.raw, record)
        fetched = record.fetched_at_utc
        if record.kind == releases.KIND:
            # Only the newest copy of each page counts: a date FRED has since dropped (e.g. a
            # release moved by a shutdown) must not survive from an older fetch.
            page = (record.meta["release"], record.meta["offset"])
            if page in calendar_pages_seen or record.meta["release"] not in RELEASES:
                continue
            calendar_pages_seen.add(page)
            calendar_rows += releases.calendar_rows(
                page[0], releases.parse_release_dates(payload), "fred:release/dates"
            )
            continue
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
    calendar = _frame(
        calendar_rows, CALENDAR_SCHEMA, keys=["release", "release_date"],
        sort=["release", "release_date"],
    )
    observations = _frame(
        alfred_rows, ALFRED_SCHEMA, keys=["series_id", "observation_date", "realtime_start"],
        sort=["series_id", "observation_date", "realtime_start"],
    )
    markets = _frame(
        market_rows, MARKET_SCHEMA, keys=["ticker"],
        sort=["series_ticker", "event_ticker", "ticker"],
    )
    candles = _frame(
        candle_rows, CANDLE_SCHEMA, keys=["ticker", "end_period_ts"],
        sort=["ticker", "end_period_ts"],
    )

    counts = {}
    counts["release_calendar"] = _write(calendar, paths.silver / "release_calendar.parquet")
    counts["alfred_observations"] = _write(
        attach_known_from(observations, calendar), paths.silver / "alfred_observations.parquet"
    )
    counts["kalshi_markets"] = _write(markets, paths.silver / "kalshi_markets.parquet")
    counts["kalshi_candles"] = _write(candles, paths.silver / "kalshi_candles.parquet")
    return counts


def _frame(
    rows: list[dict], schema: dict[str, pl.DataType], keys: list[str], sort: list[str]
) -> pl.DataFrame:
    return (
        pl.DataFrame(rows, schema=schema)
        .unique(subset=keys, keep="first", maintain_order=True)
        .sort(sort)
    )


def _write(df: pl.DataFrame, out: Path) -> int:
    if df.is_empty():
        return 0
    df.write_parquet(out, compression="zstd")
    return df.height
