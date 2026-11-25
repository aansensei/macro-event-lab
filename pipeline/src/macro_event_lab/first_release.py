"""First prints and revisions: how each published number looked on release day and later.

first_prints pairs a period's level with the previous period's level from the vintage of the
release day, units_as_of does the same for any later vintage, and revisions compares the first
print with the next release and the current vintage. Nothing here reads market data.
"""

from __future__ import annotations

from datetime import date

import polars as pl

# The ALFRED series behind each Kalshi series and the months between observations. The Fed
# target rate is not in ALFRED here, so FOMC events use Kalshi's settled value instead.
FIRST_PRINT_SERIES = {
    "KXCPI": ("CPIAUCSL", 1),
    "KXPAYROLLS": ("PAYEMS", 1),
    "KXGDP": ("GDPC1", 3),
}


def in_kalshi_units(series_ticker: str, value: float, previous: float) -> float:
    """The published number Kalshi settles on, from two consecutive ALFRED levels.

    CPI: month-over-month % change to 0.1; payrolls: jobs added (PAYEMS is in thousands),
    to the nearest thousand; GDP: quarter-over-quarter growth at an annual rate, % to 0.1.
    """
    if series_ticker == "KXCPI":
        return round((value / previous - 1) * 100, 1)
    if series_ticker == "KXPAYROLLS":
        return round((value - previous) * 1000, -3)
    if series_ticker == "KXGDP":
        return round(((value / previous) ** 4 - 1) * 100, 1)
    raise ValueError(f"no first-print rule for {series_ticker}")


def first_prints(observations: pl.DataFrame) -> pl.DataFrame:
    """One row per (series_ticker, reference_period): its first release and first print.

    Both levels come from the vintage of the release day, so the change is the one actually
    announced, not one mixing a later revision of the previous period.
    """
    frames = []
    for series_ticker, (series_id, lag_months) in FIRST_PRINT_SERIES.items():
        obs = observations.filter(pl.col("series_id") == series_id)
        first = (
            obs.group_by("observation_date")
            .agg(release_date=pl.col("realtime_start").min())
            .join(obs, left_on=["observation_date", "release_date"],
                  right_on=["observation_date", "realtime_start"])
            .select("observation_date", "release_date", "value")
            .with_columns(
                previous_date=pl.col("observation_date").dt.offset_by(f"-{lag_months}mo")
            )
        )
        previous = obs.select(
            previous_date="observation_date", previous_value="value",
            prev_start="realtime_start", prev_end="realtime_end",
        )
        # the previous period's value as it stood on the release day
        in_vintage = (pl.col("prev_start") <= pl.col("release_date")) & (
            pl.col("prev_end").is_null() | (pl.col("prev_end") >= pl.col("release_date"))
        )
        paired = first.join(previous, on="previous_date", how="left").filter(
            pl.col("prev_start").is_null() | in_vintage
        )
        frames.append(
            paired.with_columns(
                series_ticker=pl.lit(series_ticker),
                first_print=pl.struct("value", "previous_value").map_elements(
                    lambda r, s=series_ticker: None
                    if r["value"] is None or r["previous_value"] is None
                    else in_kalshi_units(s, r["value"], r["previous_value"]),
                    return_dtype=pl.Float64,
                ),
            ).select(
                "series_ticker", "release_date", reference_period="observation_date",
                first_print="first_print",
            )
        )
    return pl.concat(frames).sort("series_ticker", "reference_period")


# Revisions are studied from this period on; older first vintages are not always the true release
REVISIONS_SINCE = date(2000, 1, 1)
REVISION_SCHEMA = {
    "series_ticker": pl.String, "reference_period": pl.Date, "release_date": pl.Date,
    "first_print": pl.Float64, "next_release_date": pl.Date, "next_print": pl.Float64,
    "latest_print": pl.Float64, "latest_vintage": pl.Date,
}
# Stands for "today": a vintage still current has no end date, so it covers any later day
CURRENT = date(9999, 12, 31)


def units_as_of(
    series_ticker: str, observations: pl.DataFrame, targets: pl.DataFrame
) -> pl.DataFrame:
    """(reference_period, as_of, value): each period in Kalshi units as of the vintage `as_of`.

    Both the period's level and the previous period's level come from that same vintage, the
    way first_prints pairs them on the release day. Periods missing from that vintage drop out.
    """
    series_id, lag_months = FIRST_PRINT_SERIES[series_ticker]
    levels = observations.filter(pl.col("series_id") == series_id).select(
        "observation_date", "value", "realtime_start", "realtime_end"
    )
    in_vintage = (pl.col("realtime_start") <= pl.col("as_of")) & (
        pl.col("realtime_end").is_null() | (pl.col("realtime_end") >= pl.col("as_of"))
    )

    def level_at(period_col: str, name: str) -> pl.DataFrame:
        return (
            targets.with_columns(
                previous=pl.col("reference_period").dt.offset_by(f"-{lag_months}mo")
            )
            .join(levels, left_on=period_col, right_on="observation_date")
            .filter(in_vintage)
            .select("reference_period", "as_of", pl.col("value").alias(name))
        )

    return (
        level_at("reference_period", "level")
        .join(level_at("previous", "previous_level"), on=["reference_period", "as_of"])
        .with_columns(
            value=pl.struct("level", "previous_level").map_elements(
                lambda r: None
                if r["level"] is None or r["previous_level"] is None
                else in_kalshi_units(series_ticker, r["level"], r["previous_level"]),
                return_dtype=pl.Float64,
            )
        )
        .select("reference_period", "as_of", "value")
    )


def revisions(observations: pl.DataFrame, since: date = REVISIONS_SINCE) -> pl.DataFrame:
    """One row per (series_ticker, reference_period) from `since`: how its number changed.

    first_print is the number on release day; next_print the same period in the series'
    next vintage (the next report, which for payrolls and GDP carries the first revision);
    latest_print the period in the current vintage. latest_vintage is the newest vintage date.
    """
    prints = first_prints(observations).filter(
        (pl.col("reference_period") >= since) & pl.col("first_print").is_not_null()
    )
    frames = []
    for series_ticker, (series_id, _) in FIRST_PRINT_SERIES.items():
        firsts = prints.filter(pl.col("series_ticker") == series_ticker).sort("release_date")
        if firsts.height == 0:
            continue
        vintages = (
            observations.filter(pl.col("series_id") == series_id)
            .select(next_release_date="realtime_start").unique().sort("next_release_date")
        )
        rows = firsts.with_columns(after=pl.col("release_date").dt.offset_by("1d")).join_asof(
            vintages, left_on="after", right_on="next_release_date", strategy="forward"
        )
        nexts = units_as_of(
            series_ticker, observations,
            rows.filter(pl.col("next_release_date").is_not_null())
            .select("reference_period", as_of="next_release_date"),
        ).select("reference_period", next_print="value")
        latest = units_as_of(
            series_ticker, observations,
            rows.select("reference_period", as_of=pl.lit(CURRENT)),
        ).select("reference_period", latest_print="value")
        frames.append(
            rows.join(nexts, on="reference_period", how="left")
            .join(latest, on="reference_period", how="left")
            .with_columns(latest_vintage=vintages["next_release_date"].max())
            .select(
                "series_ticker", "reference_period", "release_date", "first_print",
                "next_release_date", "next_print", "latest_print", "latest_vintage",
            )
        )
    if not frames:
        return pl.DataFrame(schema=REVISION_SCHEMA)
    return pl.concat(frames).sort("series_ticker", "reference_period")


def latest_per_release(prints: pl.DataFrame) -> pl.DataFrame:
    """One row per (series_ticker, release_date): the latest period first published that day.

    A release that first publishes several periods (a skipped month) is about the latest one.
    """
    return (
        prints.sort("series_ticker", "release_date", "reference_period")
        .group_by("series_ticker", "release_date", maintain_order=True)
        .last()
    )
