"""Source dates and executed quality checks for the public data snapshot."""

from __future__ import annotations

import re
from datetime import UTC, date, datetime

import duckdb
import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.quality import CHECKS, run_checks

PUBLIC_CHECK_NAMES = (
    "duplicates_alfred_observations",
    "duplicates_release_calendar",
    "missing_observations",
    "spf_forecasts",
)
SOURCE_SPECS = (
    ("alfred", "ALFRED, Federal Reserve Bank of St. Louis", "alfred_observations",
     "realtime_start", "series_id", 7),
    ("spf", "Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF)",
     "spf_forecasts", "known_from", "variable", 120),
)


def build_status(paths: Paths, information_date: date) -> dict[str, object]:
    """Describe source vintages and checks without exposing individual problem records."""
    sources: list[dict[str, object]] = []
    for source_id, label, table, date_column, series_column, max_age_days in SOURCE_SPECS:
        path = paths.silver / f"{table}.parquet"
        if not path.exists():
            continue
        frame = pl.read_parquet(path)
        if frame.is_empty():
            continue
        latest = pl.col(date_column)
        if source_id == "spf":
            latest = latest.dt.convert_time_zone("America/New_York").dt.date()
        latest_date = frame.select(latest.max()).item()
        if latest_date is None:
            continue
        age_days = (information_date - latest_date).days
        sources.append({
            "id": source_id,
            "label": label,
            "latest_vintage_date": latest_date.isoformat(),
            "series_count": frame[series_column].drop_nulls().n_unique(),
            "rows": frame.height,
            "max_age_days": max_age_days,
            "is_fresh": 0 <= age_days <= max_age_days,
        })

    checks = [check for name in PUBLIC_CHECK_NAMES for check in CHECKS if check.name == name]
    for check in checks:
        if re.search(
            r"market|candle|strike|price|kalshi|\bkx", check.name + check.description, re.I,
        ):
            raise ValueError("A public quality check contains restricted source wording")
    published_checks: list[dict[str, object]] = []
    with duckdb.connect() as con:
        for table in ("alfred_observations", "release_calendar", "spf_forecasts"):
            path = paths.silver / f"{table}.parquet"
            if path.exists():
                con.register(table, pl.read_parquet(path))
        for result in run_checks(con, checks=checks, anomalies=[]):
            if result.problems is None:
                continue
            published_checks.append({
                "name": result.check.name,
                "status": result.status.lower(),
                "problems": result.problems.height,
                "description": result.check.description,
            })
    return {
        "schema_version": 1,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "information_date": information_date.isoformat(),
        "sources": sources,
        "checks": published_checks,
    }
