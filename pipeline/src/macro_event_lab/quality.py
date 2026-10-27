"""Data quality checks on the silver tables.

Each check is one SQL query that returns one row per problem, so an empty result means the
check passed and a non-empty one shows exactly which rows are wrong. Checks with severity
"error" make `check` fail; "warn" checks report known, explainable gaps in the real data.
"""

from __future__ import annotations

from dataclasses import dataclass

import duckdb
import polars as pl

QUARTERLY_SERIES = ("GDPC1",)  # every other ALFRED series here is monthly


@dataclass(frozen=True)
class Check:
    name: str
    severity: str  # "error" or "warn"
    description: str
    sql: str


@dataclass(frozen=True)
class CheckResult:
    check: Check
    problems: pl.DataFrame | None  # None: a table the check needs is not built yet

    @property
    def status(self) -> str:
        if self.problems is None:
            return "SKIP"
        if self.problems.is_empty():
            return "PASS"
        return "FAIL" if self.check.severity == "error" else "WARN"


def _duplicates(table: str, keys: list[str]) -> Check:
    cols = ", ".join(keys)
    return Check(
        name=f"duplicates_{table}",
        severity="error",
        description=f"{table} must have one row per ({cols})",
        sql=f"SELECT {cols}, count(*) AS copies FROM {table} GROUP BY ALL HAVING count(*) > 1",
    )


_quarterly = ", ".join(f"'{s}'" for s in QUARTERLY_SERIES)

CHECKS: list[Check] = [
    Check(
        name="missing_observations",
        severity="warn",
        description=(
            "every month (quarter for GDP) between a series' first and last observation has a "
            "value in the current vintage"
        ),
        sql=f"""
            WITH cur AS (
                SELECT series_id, observation_date, value
                FROM alfred_observations WHERE realtime_end IS NULL
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
            "a market has a strike type and a strike (legacy CPI-* style markets only carry "
            "the threshold in the ticker)"
        ),
        sql="""
            SELECT series_ticker, event_ticker, ticker, strike_type, floor_strike, cap_strike
            FROM kalshi_markets
            WHERE strike_type IS NULL OR (floor_strike IS NULL AND cap_strike IS NULL)
            ORDER BY series_ticker, event_ticker, ticker
        """,
    ),
]


def run_checks(con: duckdb.DuckDBPyConnection, checks: list[Check] = CHECKS) -> list[CheckResult]:
    results = []
    for check in checks:
        try:
            problems = con.sql(check.sql).pl()
        except duckdb.CatalogException:
            problems = None
        results.append(CheckResult(check, problems))
    return results
