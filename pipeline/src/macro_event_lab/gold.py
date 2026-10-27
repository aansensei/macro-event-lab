"""Gold layer: tables derived from silver for analysis and the website.

contract_prices turns each hourly Kalshi candle into one usable YES price: the bid/ask mid
when the book is sane and tight, else the last trade, else nothing.

implied_distributions reads, for every event and every hour of the 7 days before it closes,
the latest usable price of each "above k" contract known at that hour. Those prices estimate
the survival function S(k) = P(X > k); isotonic regression weighted by inverse spread makes S
non-increasing in k, and differences of S give the probability of each outcome bin, which sum
to 1 by construction.
"""

from __future__ import annotations

from datetime import datetime

import polars as pl

from macro_event_lab.config import Paths

# In the 7 days before a market closes, 96 to 99.7% of candles have a spread of at most
# 10 cents (median 1 to 2 cents), so a wider book no longer says where the price is.
MAX_SPREAD = 0.10
# Kalshi quotes in 1 cent steps, so a locked book (bid equal to ask) counts as 1 cent wide
MIN_SPREAD = 0.01
WINDOW_HOURS = 168
SNAPSHOT_KEYS = ["series_ticker", "event_ticker", "ts", "hours_before_close"]
BIN_TYPE = pl.Struct({"bin_lower": pl.Float64, "bin_upper": pl.Float64, "prob": pl.Float64})


def contract_prices(candles: pl.DataFrame) -> pl.DataFrame:
    """One price per (ticker, end_period_ts) with its source ("mid", "trade" or null) and weight.

    A crossed book (bid above ask, e.g. the stale bids listed in quality.KNOWN_ANOMALIES)
    never yields a mid; it falls back to the trade price like a too-wide book does.
    The weight is the inverse spread (a 1 cent book weighs 100, a 10 cent book 10); a trade
    price weighs at most as much as the widest acceptable book, so it never outranks a mid.
    """
    bid, ask = pl.col("yes_bid_close"), pl.col("yes_ask_close")
    # rounding keeps 0.55 - 0.45 (0.10000000000000003 in floating point) inside the limit
    spread = (ask - bid).round(6)
    usable_mid = (bid <= ask) & (spread <= MAX_SPREAD)
    has_trade = pl.col("price_close").is_not_null()
    return (
        candles.select("ticker", "end_period_ts", "yes_bid_close", "yes_ask_close", "price_close")
        .with_columns(spread=spread)
        .with_columns(
            price=pl.when(usable_mid).then((bid + ask) / 2)
            .when(has_trade).then(pl.col("price_close"))
            .otherwise(None),
            price_source=pl.when(usable_mid).then(pl.lit("mid"))
            .when(has_trade).then(pl.lit("trade"))
            .otherwise(pl.lit(None, dtype=pl.String)),
            weight=pl.when(usable_mid).then(1 / pl.max_horizontal(spread, MIN_SPREAD))
            .when(has_trade).then(1 / pl.max_horizontal(spread.abs(), MAX_SPREAD))
            .otherwise(None),
        )
        .sort("ticker", "end_period_ts")
    )


def isotonic_decreasing(values: list[float], weights: list[float] | None = None) -> list[float]:
    """Closest non-increasing sequence in weighted least squares (pool adjacent violators).

    Values are clipped to [0, 1] first, since they are probabilities. A pooled run takes the
    weighted mean of its values, so a low-weight outlier moves its neighbours very little.
    """
    weights = weights if weights is not None else [1.0] * len(values)
    blocks: list[list[float]] = []  # [weighted sum, total weight, length] of each pooled run
    for v, w in zip(values, weights, strict=True):
        blocks.append([min(1.0, max(0.0, v)) * w, w, 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] < blocks[-1][0] / blocks[-1][1]:
            total, weight, length = blocks.pop()
            blocks[-1][0] += total
            blocks[-1][1] += weight
            blocks[-1][2] += length
    return [total / weight for total, weight, length in blocks for _ in range(int(length))]


def bins_from_survival(
    strikes: list[float], survival: list[float]
) -> list[tuple[float | None, float | None, float]]:
    """(lower, upper, probability) for X <= k1, then k_i < X <= k_{i+1}, then X > k_n.

    `survival` must be non-increasing; None marks an open end.
    """
    s = [1.0, *survival, 0.0]
    edges = [None, *strikes, None]
    return [(edges[i], edges[i + 1], s[i] - s[i + 1]) for i in range(len(s) - 1)]


def snapshot_grid(markets: pl.DataFrame, data_end: datetime) -> pl.DataFrame:
    """One row per (event, hour) for the WINDOW_HOURS before the event closes.

    The event's close is the most common close time of its markets, truncated to the hour.
    Hours after `data_end` are dropped, so events that have not reached their window yet get
    no snapshots instead of snapshots built from old prices.
    """
    events = (
        markets.group_by("series_ticker", "event_ticker")
        .agg(close=pl.col("close_time").mode().max())
        .with_columns(
            anchor=pl.col("close").dt.truncate("1h"),
            hours_before_close=pl.lit(list(range(WINDOW_HOURS, -1, -1))),
        )
        .explode("hours_before_close")
    )
    return (
        events.with_columns(ts=pl.col("anchor") - pl.duration(hours=pl.col("hours_before_close")))
        .filter(pl.col("ts") <= data_end)
        .select(SNAPSHOT_KEYS)
    )


def implied_distributions(
    markets: pl.DataFrame, prices: pl.DataFrame
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """(survival, bins) tables for every event snapshot.

    survival: one row per contract in a snapshot with its raw price, the age of that price and
    the isotonic S(k). bins: one row per outcome bin with its probability.
    """
    above = markets.filter(
        (pl.col("strike_type") == "greater") & pl.col("floor_strike").is_not_null()
    )
    valid = prices.filter(pl.col("price").is_not_null()).select(
        "ticker", "end_period_ts", "price", "weight"
    )
    grid = snapshot_grid(above, valid["end_period_ts"].max())

    # each contract takes its latest usable price at or before the snapshot hour
    members = (
        grid.join(above.select("event_ticker", "ticker", "floor_strike"), on="event_ticker")
        .sort("ts")
        .join_asof(
            valid.sort("end_period_ts"), left_on="ts", right_on="end_period_ts",
            by="ticker", strategy="backward", check_sortedness=False,
        )
        .filter(pl.col("price").is_not_null())
        .with_columns(
            price_age_h=(pl.col("ts") - pl.col("end_period_ts")).dt.total_hours()
        )
        .sort([*SNAPSHOT_KEYS, "floor_strike", "ticker"])
    )

    fitted = (
        members.group_by(SNAPSHOT_KEYS, maintain_order=True)
        .agg("ticker", "floor_strike", "price", "weight", "price_age_h")
        .with_columns(
            survival=pl.struct("price", "weight").map_elements(
                lambda r: isotonic_decreasing(list(r["price"]), list(r["weight"])),
                return_dtype=pl.List(pl.Float64),
            )
        )
    )
    survival = fitted.explode(
        ["ticker", "floor_strike", "price", "weight", "price_age_h", "survival"]
    )
    bins = (
        fitted.with_columns(
            bins=pl.struct("floor_strike", "survival").map_elements(
                lambda r: [
                    {"bin_lower": lo, "bin_upper": hi, "prob": p}
                    for lo, hi, p in bins_from_survival(r["floor_strike"], r["survival"])
                ],
                return_dtype=pl.List(BIN_TYPE),
            )
        )
        .select([*SNAPSHOT_KEYS, "bins"])
        .explode("bins")
        .unnest("bins")
    )
    return survival, bins


def build_gold(paths: Paths) -> dict[str, int]:
    candles = pl.read_parquet(paths.silver / "kalshi_candles.parquet")
    markets = pl.read_parquet(paths.silver / "kalshi_markets.parquet")
    paths.gold.mkdir(parents=True, exist_ok=True)
    prices = contract_prices(candles)
    survival, bins = implied_distributions(markets, prices)
    tables = {"contract_prices": prices, "implied_survival": survival, "implied_bins": bins}
    for name, df in tables.items():
        df.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    return {name: df.height for name, df in tables.items()}
