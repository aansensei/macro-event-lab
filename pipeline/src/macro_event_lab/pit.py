"""Point-in-time access: what was public at a given moment, and nothing published later.

Every ALFRED vintage gets `known_from`, the moment it became public. `as_of(ts)` then picks,
for each observation, the newest vintage with known_from <= ts, and for each Kalshi market
open at ts, its last finished candle. Both lookups are DuckDB ASOF JOINs.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import duckdb
import polars as pl

from macro_event_lab.config import RELEASE_TZ, RELEASES

SERIES_RELEASE = {s: name for name, r in RELEASES.items() for s in r.alfred_series}
SILVER_TABLES = ("alfred_observations", "kalshi_markets", "kalshi_candles", "release_calendar")


def attach_known_from(obs: pl.DataFrame, calendar: pl.DataFrame) -> pl.DataFrame:
    """Add `release`, `known_from` (UTC) and `known_from_source` to ALFRED observations.

    ALFRED only says on which date a vintage appeared. When that date is a release date of
    the series' release, known_from is the official release moment (e.g. 08:30 New York).
    Otherwise (revisions outside the calendar, dates before the calendar starts) it is the
    end of that New York day, so a vintage is never treated as known earlier than it was.
    """
    series_release = pl.DataFrame(
        {"series_id": list(SERIES_RELEASE), "release": list(SERIES_RELEASE.values())}
    )
    release_moments = calendar.select(
        "release", pl.col("release_date").alias("realtime_start"), "release_ts"
    )
    end_of_day = (
        (pl.col("realtime_start").cast(pl.Datetime("us")) + pl.duration(hours=23, minutes=59,
                                                                        seconds=59))
        .dt.replace_time_zone(RELEASE_TZ)
        .dt.convert_time_zone("UTC")
    )
    return (
        obs.join(series_release, on="series_id", how="left")
        .join(release_moments, on=["release", "realtime_start"], how="left")
        .with_columns(
            known_from=pl.coalesce("release_ts", end_of_day),
            known_from_source=pl.when(pl.col("release_ts").is_null())
            .then(pl.lit("date_end_of_day"))
            .otherwise(pl.lit("release_calendar")),
        )
        .drop("release_ts")
    )


def connect(silver_dir: Path) -> duckdb.DuckDBPyConnection:
    """In-memory DuckDB with one view per silver Parquet table that exists.

    Timestamps display in New York time, the clock the release calendar is set in.
    """
    con = duckdb.connect()
    con.execute(f"SET TimeZone = '{RELEASE_TZ}'")
    for table in SILVER_TABLES:
        path = silver_dir / f"{table}.parquet"
        if path.exists():
            quoted = path.as_posix().replace("'", "''")
            con.execute(f"CREATE VIEW {table} AS SELECT * FROM read_parquet('{quoted}')")
    return con


# For each (series, observation) key, the ASOF JOIN keeps the one vintage whose known_from is
# the largest value <= $ts. Keys with no such vintage (not yet published at $ts) drop out.
ALFRED_AS_OF_SQL = """
WITH keys AS (
    SELECT DISTINCT series_id, observation_date, $ts::TIMESTAMPTZ AS as_of_ts
    FROM alfred_observations
)
SELECT o.series_id, o.observation_date, o.value, o.realtime_start, o.known_from,
       o.known_from_source
FROM keys k
ASOF JOIN alfred_observations o
  ON k.series_id = o.series_id
 AND k.observation_date = o.observation_date
 AND k.as_of_ts >= o.known_from
ORDER BY o.series_id, o.observation_date
"""

# Markets open at $ts, each with its last candle that had ended by $ts. Settlement fields
# (result, expiration_value, settlement_ts) are left out on purpose: they are future data.
KALSHI_AS_OF_SQL = """
WITH open_markets AS (
    SELECT ticker, event_ticker, series_ticker, strike_type, floor_strike, cap_strike,
           close_time, $ts::TIMESTAMPTZ AS as_of_ts
    FROM kalshi_markets
    WHERE open_time <= $ts::TIMESTAMPTZ AND $ts::TIMESTAMPTZ < close_time
)
SELECT m.series_ticker, m.event_ticker, m.ticker, m.strike_type, m.floor_strike,
       m.cap_strike, m.close_time, c.end_period_ts, c.yes_bid_close, c.yes_ask_close,
       c.price_close, c.volume, c.open_interest
FROM open_markets m
ASOF JOIN kalshi_candles c
  ON m.ticker = c.ticker
 AND m.as_of_ts >= c.end_period_ts
ORDER BY m.series_ticker, m.event_ticker, m.floor_strike, m.ticker
"""


@dataclass(frozen=True)
class AsOf:
    ts: datetime
    alfred: pl.DataFrame  # one row per observation: the newest vintage public at ts
    kalshi: pl.DataFrame  # one row per market open at ts: its last finished candle


def _require_aware(ts: datetime) -> None:
    if ts.tzinfo is None:
        raise ValueError("as_of needs a timezone-aware timestamp, e.g. 2026-10-14T12:30Z")


def alfred_as_of(con: duckdb.DuckDBPyConnection, ts: datetime) -> pl.DataFrame:
    _require_aware(ts)
    return con.sql(ALFRED_AS_OF_SQL, params={"ts": ts}).pl()


def kalshi_as_of(con: duckdb.DuckDBPyConnection, ts: datetime) -> pl.DataFrame:
    _require_aware(ts)
    return con.sql(KALSHI_AS_OF_SQL, params={"ts": ts}).pl()


def as_of(con: duckdb.DuckDBPyConnection, ts: datetime) -> AsOf:
    return AsOf(ts=ts, alfred=alfred_as_of(con, ts), kalshi=kalshi_as_of(con, ts))
