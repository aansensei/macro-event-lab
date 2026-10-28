"""Data quality checks on the silver tables.

Each check is one SQL query that returns one row per problem, so an empty result means the
check passed and a non-empty one shows exactly which rows are wrong. Checks with severity
"error" make `check` fail; "warn" checks report known, explainable gaps in the real data.
Rows covered by a `KnownAnomaly` are reported as excused instead of failing the check, so a
single investigated quirk in the source data does not hide new problems.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import duckdb
import polars as pl

QUARTERLY_SERIES = ("GDPC1",)
# daily market series skip weekends and holidays by design, so they have no expected calendar
DAILY_SERIES = ("DGS2", "DGS10")  # every other ALFRED series here is monthly


@dataclass(frozen=True)
class Check:
    name: str
    severity: str  # "error" or "warn"
    description: str
    sql: str


@dataclass(frozen=True)
class KnownAnomaly:
    """Problem rows of one check, for one ticker, within [start, end] (end_period_ts)."""

    check: str
    ticker: str
    start: datetime
    end: datetime
    reason: str


# Investigated quirks of the source data. Gold tables must still treat these rows as unusable
# (e.g. no bid/ask mid from a crossed candle); the list only stops them from failing `check`.
KNOWN_ANOMALIES: list[KnownAnomaly] = [
    KnownAnomaly(
        check="bid_above_ask",
        ticker="FED-22DEC-T4.50",
        start=datetime.fromisoformat("2022-11-15T02:00:00+00:00"),
        end=datetime.fromisoformat("2022-11-15T17:00:00+00:00"),
        reason=(
            "Archived Kalshi candles keep the yes bid at 0.22 while the ask falls to 0.21 and "
            "0.19 and trades print at 0.21 and 0.19, below that bid: a stale bid in the "
            "history, not a real crossed book. Seen 2026-10-27."
        ),
    ),
]


@dataclass(frozen=True)
class CheckResult:
    check: Check
    problems: pl.DataFrame | None  # None: a table the check needs is not built yet
    excused: pl.DataFrame = field(default_factory=pl.DataFrame)  # rows matched a KnownAnomaly

    @property
    def status(self) -> str:
        if self.problems is None:
            return "SKIP"
        if self.problems.is_empty():
            return "PASS"
        return "FAIL" if self.check.severity == "error" else "WARN"


def split_known(
    check_name: str, problems: pl.DataFrame, anomalies: list[KnownAnomaly]
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Split problem rows into (still problems, excused by a known anomaly)."""
    rules = [a for a in anomalies if a.check == check_name]
    if not rules or not {"ticker", "end_period_ts"} <= set(problems.columns):
        return problems, problems.clear()
    ts = pl.col("end_period_ts").dt.convert_time_zone("UTC")
    known = pl.any_horizontal(
        (pl.col("ticker") == a.ticker) & ts.is_between(a.start, a.end) for a in rules
    )
    return problems.filter(~known), problems.filter(known)


def _duplicates(table: str, keys: list[str]) -> Check:
    cols = ", ".join(keys)
    return Check(
        name=f"duplicates_{table}",
        severity="error",
        description=f"{table} must have one row per ({cols})",
        sql=f"SELECT {cols}, count(*) AS copies FROM {table} GROUP BY ALL HAVING count(*) > 1",
    )


_quarterly = ", ".join(f"'{s}'" for s in QUARTERLY_SERIES)
_daily = ", ".join(f"'{s}'" for s in DAILY_SERIES)

CHECKS: list[Check] = [
    Check(
        name="missing_observations",
        severity="warn",
        description=(
            "every month (quarter for GDP) between a series' first and last observation has a "
            "value in the current vintage; daily yields are not checked"
        ),
        sql=f"""
            WITH cur AS (
                SELECT series_id, observation_date, value
                FROM alfred_observations
                WHERE realtime_end IS NULL AND series_id NOT IN ({_daily})
            ),
            expected AS (
                SELECT series_id,
                       unnest(generate_series(
                           min(observation_date), max(observation_date),
                           CASE WHEN series_id IN ({_quarterly})
                                THEN INTERVAL 3 MONTH ELSE INTERVAL 1 MONTH END
                       ))::DATE AS observation_date
                FROM cur GROUP BY series_id
            )
            SELECT e.series_id, e.observation_date,
                   CASE WHEN c.observation_date IS NULL THEN 'no row' ELSE 'null value' END
                       AS problem
            FROM expected e
            LEFT JOIN cur c USING (series_id, observation_date)
            WHERE c.value IS NULL
            ORDER BY e.series_id, e.observation_date
        """,
    ),
    _duplicates("alfred_observations", ["series_id", "observation_date", "realtime_start"]),
    _duplicates("kalshi_markets", ["ticker"]),
    _duplicates("kalshi_candles", ["ticker", "end_period_ts"]),
    _duplicates("release_calendar", ["release", "release_date"]),
    Check(
        name="bid_above_ask",
        severity="error",
        description="a candle's closing yes bid is never above its closing yes ask",
        sql="""
            SELECT ticker, end_period_ts, yes_bid_close, yes_ask_close
            FROM kalshi_candles WHERE yes_bid_close > yes_ask_close
            ORDER BY ticker, end_period_ts
        """,
    ),
    Check(
        name="price_out_of_range",
        severity="error",
        description="Kalshi prices are probabilities in dollars, so they lie in [0, 1]",
        sql="""
            SELECT ticker, end_period_ts, yes_bid_close, yes_ask_close, price_close, price_mean
            FROM kalshi_candles
            WHERE NOT (yes_bid_close BETWEEN 0 AND 1) OR NOT (yes_ask_close BETWEEN 0 AND 1)
               OR NOT (price_close BETWEEN 0 AND 1) OR NOT (price_mean BETWEEN 0 AND 1)
            ORDER BY ticker, end_period_ts
        """,
    ),
    Check(
        name="market_missing_strike",
        severity="warn",
        description=(
            "a market has a strike type and a strike, from the API or parsed from the ticker"
        ),
        sql="""
            SELECT series_ticker, event_ticker, ticker, strike_type, floor_strike, cap_strike
            FROM kalshi_markets
            WHERE strike_type IS NULL OR (floor_strike IS NULL AND cap_strike IS NULL)
            ORDER BY series_ticker, event_ticker, ticker
        """,
    ),
    Check(
        name="settled_result_matches_strike",
        severity="error",
        description=(
            "a settled 'greater' market resolved yes exactly when the published value is "
            "above its strike (catches a wrongly parsed or wrongly signed strike)"
        ),
        # expiration_value comes as "0.3", "0.25%", ".9%", "22,000" or a range "0-0.25";
        # the last number not glued to a preceding digit is the published value, and
        # descriptive values such as "Above 3.50%" are skipped rather than guessed
        sql="""
            WITH settled AS (
                SELECT ticker, strike_source, floor_strike, expiration_value, result,
                       CASE WHEN regexp_matches(expiration_value, '^[0-9.,%+ -]+$')
                            THEN TRY_CAST(regexp_extract(replace(expiration_value, ',', ''),
                                '(?:^|[^0-9.])(-?[0-9]*\\.?[0-9]+)%?\\s*$', 1) AS DOUBLE)
                       END AS value
                FROM kalshi_markets
                WHERE strike_type = 'greater' AND result IN ('yes', 'no')
            )
            SELECT ticker, strike_source, floor_strike, expiration_value, value, result
            FROM settled
            WHERE value IS NOT NULL AND (result = 'yes') <> (value > floor_strike)
            ORDER BY ticker
        """,
    ),
]


def run_checks(
    con: duckdb.DuckDBPyConnection,
    checks: list[Check] = CHECKS,
    anomalies: list[KnownAnomaly] = KNOWN_ANOMALIES,
) -> list[CheckResult]:
    results = []
    for check in checks:
        try:
            problems = con.sql(check.sql).pl()
        except duckdb.CatalogException:
            results.append(CheckResult(check, None))
            continue
        remaining, excused = split_known(check.name, problems, anomalies)
        results.append(CheckResult(check, remaining, excused))
    return results
