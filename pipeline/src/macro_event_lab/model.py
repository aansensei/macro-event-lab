"""Calibration model data: one row per settled "above k" contract at a snapshot hour.

Each row holds what the market said at that hour and a few features built only from
snapshots at or before it, plus the contract's settled outcome as the label. The model asks
whether those features predict the outcome better than the market price alone.
"""

from __future__ import annotations

import math

import polars as pl

# Snapshot hours used for training: an hour, a day and a week before the close
HORIZONS = (1, 24, 168)
# Prices are clipped away from 0 and 1 before taking the logit, so one extreme quote cannot
# dominate the fit; Kalshi prices move in 1 cent steps
CLIP = 0.01
# The earlier snapshot used for the price change feature
CHANGE_HOURS = 24


def logit(p: float) -> float:
    q = min(max(p, CLIP), 1 - CLIP)
    return math.log(q / (1 - q))


def calibration_rows(
    survival: pl.DataFrame,
    stats: pl.DataFrame,
    markets: pl.DataFrame,
    horizons: tuple[int, ...] = HORIZONS,
) -> pl.DataFrame:
    """Training rows for the calibration model, one per (contract, horizon).

    Features, all known at the row's snapshot time `ts`:
    - market_logit: logit of the isotonic fit of the market price at that hour
    - spread: the quoted spread behind the price (1 / weight), wider means less trusted
    - price_age_h: hours since that price was last updated
    - strike_z: the strike's distance from the implied median in implied SDs (0 without a
      distribution); has_distribution marks rows where it exists
    - change_24h: market_logit now minus 24 hours earlier, 0 when the contract was not priced then
    The label `outcome` is 1 when the contract settled yes. Only finalized yes or no markets count.
    """
    to_logit = pl.col("survival").map_elements(logit, return_dtype=pl.Float64)
    snaps = survival.select(
        "series_ticker", "event_ticker", "ticker", "ts", "hours_before_close", "floor_strike",
        "weight", "price_age_h", raw_prob="price", market_prob="survival", market_logit=to_logit,
    )
    earlier = snaps.select(
        "ticker",
        hours_before_close=pl.col("hours_before_close") - CHANGE_HOURS,
        earlier_logit="market_logit",
    )
    labels = markets.filter(
        (pl.col("status") == "finalized") & pl.col("result").is_in(["yes", "no"])
    ).select("ticker", outcome=(pl.col("result") == "yes").cast(pl.Int8))
    dist = stats.select("event_ticker", "ts", "p50", "sd")

    return (
        snaps.filter(pl.col("hours_before_close").is_in(list(horizons)))
        .join(labels, on="ticker", how="inner")
        .join(earlier, on=["ticker", "hours_before_close"], how="left")
        .join(dist, on=["event_ticker", "ts"], how="left")
        .with_columns(
            has_distribution=pl.col("sd").is_not_null() & (pl.col("sd") > 0),
            spread=1 / pl.col("weight"),
            event_close=pl.col("ts") + pl.duration(hours=pl.col("hours_before_close")),
        )
        .with_columns(
            strike_z=pl.when(pl.col("has_distribution"))
            .then((pl.col("floor_strike") - pl.col("p50")) / pl.col("sd"))
            .otherwise(0.0),
            change_24h=(pl.col("market_logit") - pl.col("earlier_logit")).fill_null(0.0),
        )
        .select(
            "series_ticker", "event_ticker", "ticker", "event_close", "ts", "hours_before_close",
            "floor_strike", "raw_prob", "market_prob", "market_logit", "spread", "price_age_h",
            "strike_z", "has_distribution", "change_24h", "outcome",
        )
        .sort("event_close", "event_ticker", "hours_before_close", "floor_strike")
    )
