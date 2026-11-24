"""First published targets and the forecast origins of the arena."""

from __future__ import annotations

from datetime import date, timedelta
from zoneinfo import ZoneInfo

import polars as pl

from macro_event_lab.gold import REVISIONS_SINCE, first_prints

NEW_YORK = ZoneInfo("America/New_York")
SURVEY_SOURCE_PREFIX = "spf_news_release_date"

# neutral target id -> (internal first print series, label, unit, frequency)
TARGETS: dict[str, tuple[str, str, str, str]] = {
    "gdp": ("KXGDP", "GDP growth", "annualized percent q/q", "quarterly"),
    "cpi": ("KXCPI", "Inflation", "percent m/m", "monthly"),
    "payrolls": ("KXPAYROLLS", "Payrolls", "thousands of jobs", "monthly"),
}
# the first print table counts jobs; the arena reports thousands of jobs
VALUE_SCALE = {"gdp": 1.0, "cpi": 1.0, "payrolls": 0.001}

TARGET_SCHEMA = {
    "target": pl.String, "period": pl.Date, "first_print": pl.Float64, "release_date": pl.Date,
}
ORIGIN_SCHEMA = {"target": pl.String, "period": pl.Date, "made_on": pl.Date}


def add_months(day: date, months: int) -> date:
    month = day.month - 1 + months
    return date(day.year + month // 12, month % 12 + 1, 1)


def first_print_targets(observations: pl.DataFrame) -> pl.DataFrame:
    """One row per (target, period) from 2000: the number in the vintage that first published it.

    Older first vintages are not always the true first release, so they are not used.
    """
    prints = first_prints(observations).filter(
        pl.col("first_print").is_not_null() & (pl.col("reference_period") >= REVISIONS_SINCE)
    )
    frames = []
    for target, (ticker, *_rest) in TARGETS.items():
        frames.append(
            prints.filter(pl.col("series_ticker") == ticker).select(
                target=pl.lit(target),
                period="reference_period",
                first_print=pl.col("first_print") * VALUE_SCALE[target],
                release_date="release_date",
            )
        )
    return pl.concat(frames).select(list(TARGET_SCHEMA)).sort("target", "period")


def data_as_of(frame: pl.DataFrame, as_of: date, column: str = "release_date") -> pl.DataFrame:
    """Rows that were public on `as_of`."""
    return frame.filter(pl.col(column) <= as_of)


def survey_release_dates(survey: pl.DataFrame) -> pl.DataFrame:
    """(survey_year, survey_quarter, made_on) for surveys with an official news release date."""
    official = survey.filter(pl.col("known_from_source").str.starts_with(SURVEY_SOURCE_PREFIX))
    return (
        official.select("survey_year", "survey_quarter", "known_from").unique()
        .with_columns(
            made_on=pl.col("known_from").dt.convert_time_zone("America/New_York").dt.date()
        )
        .select("survey_year", "survey_quarter", "made_on")
    )


def build_origins(targets: pl.DataFrame, survey: pl.DataFrame | None) -> pl.DataFrame:
    """Forecast origins following the frozen protocol.

    Quarterly GDP uses the news release date of the survey of the target quarter; monthly
    targets use the day after the previous month's value was first published. An origin that
    is not earlier than its own first print is dropped.
    """
    rows: list[dict[str, object]] = []
    gdp = targets.filter(pl.col("target") == "gdp")
    if survey is not None and gdp.height:
        released = {
            (r["survey_year"], r["survey_quarter"]): r["made_on"]
            for r in survey_release_dates(survey).iter_rows(named=True)
        }
        for row in gdp.iter_rows(named=True):
            quarter = (row["period"].month - 1) // 3 + 1
            made_on = released.get((row["period"].year, quarter))
            if made_on is not None and made_on < row["release_date"]:
                rows.append({"target": "gdp", "period": row["period"], "made_on": made_on})
    for target in ("cpi", "payrolls"):
        frame = targets.filter(pl.col("target") == target)
        known = {r["period"]: r["release_date"] for r in frame.iter_rows(named=True)}
        for row in frame.iter_rows(named=True):
            previous = known.get(add_months(row["period"], -1))
            if previous is None:
                continue
            made_on = previous + timedelta(days=1)
            if made_on < row["release_date"]:
                rows.append({"target": target, "period": row["period"], "made_on": made_on})
    return pl.DataFrame(rows, schema=ORIGIN_SCHEMA).sort("target", "period")
