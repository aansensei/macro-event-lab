"""Gold layer: tables derived from silver for analysis and the website.

contract_prices turns each hourly Kalshi candle into one usable YES price: the bid/ask mid
when the book is sane and tight, else the last trade, else nothing.

implied_distributions reads, for every event and every hour of the 7 days before it closes,
the latest usable price of each "above k" contract known at that hour. Those prices estimate
the survival function S(k) = P(X > k); isotonic regression weighted by inverse spread makes S
non-increasing in k, and differences of S give the probability of each outcome bin, which sum
to 1 by construction.

implied_stats summarises each snapshot's bins (mean, standard deviation, 5/25/50/75/95
percentiles), and implied_bins carries the T-168h probability of each bin for comparison.
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
# Smallest step of the published number, measured on settled expiration values: CPI and GDP
# are published to 0.1 point, the Fed target upper bound moves in 0.25 point steps, and
# payrolls are published in thousands of jobs.
RESOLUTION = {"KXCPI": 0.1, "KXGDP": 0.1, "KXFED": 0.25, "KXPAYROLLS": 1000.0}
QUANTILES = (0.05, 0.25, 0.50, 0.75, 0.95)
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


def bin_intervals(
    lowers: list[float | None], uppers: list[float | None], resolution: float
) -> list[tuple[float, float]]:
    """Real-valued interval each outcome bin covers, for spreading its probability uniformly.

    A bin (a, b] holds the published values a + r, ..., b, which are what real values in
    (a + r/2, b + r/2] round to; for CPI the bin (0.3, 0.4] therefore centres on 0.4, not 0.35.
    The open tails are assumed as wide as the median gap between the strikes.
    """
    strikes = [x for x in uppers if x is not None]
    gaps = sorted(b - a for a, b in zip(strikes, strikes[1:], strict=False) if b > a)
    tail = gaps[len(gaps) // 2] if gaps else resolution
    half = resolution / 2
    out = []
    for lo, hi in zip(lowers, uppers, strict=True):
        lo = hi - tail if lo is None else lo
        hi = lo + tail if hi is None else hi
        out.append((lo + half, hi + half))
    return out


def distribution_stats(
    lowers: list[float | None],
    uppers: list[float | None],
    probs: list[float],
    resolution: float,
) -> dict[str, float | None]:
    """Mean, standard deviation and QUANTILES of a binned distribution.

    Each bin's probability is spread uniformly over its interval from bin_intervals, so the
    quantiles interpolate within a bin. Needs at least two strikes (three bins); fewer give None.
    """
    names = ["mean", "sd", *(f"p{round(q * 100):02d}" for q in QUANTILES)]
    if len(probs) < 3:
        return dict.fromkeys(names)
    intervals = bin_intervals(lowers, uppers, resolution)
    mean = sum(p * (lo + hi) / 2 for p, (lo, hi) in zip(probs, intervals, strict=True))
    second = sum(
        p * ((hi - lo) ** 2 / 12 + ((lo + hi) / 2) ** 2)
        for p, (lo, hi) in zip(probs, intervals, strict=True)
    )
    stats: dict[str, float | None] = {"mean": mean, "sd": max(0.0, second - mean**2) ** 0.5}
    for q in QUANTILES:
        cum, value = 0.0, intervals[-1][1]
        for p, (lo, hi) in zip(probs, intervals, strict=True):
            if p > 0 and cum + p >= q:
                value = lo + (q - cum) / p * (hi - lo)
                break
            cum += p
        stats[f"p{round(q * 100):02d}"] = value
    return stats


def implied_stats(bins: pl.DataFrame) -> pl.DataFrame:
    """One row of distribution_stats per snapshot, using the series' RESOLUTION."""
    stat_type = pl.Struct({
        "mean": pl.Float64, "sd": pl.Float64,
        **{f"p{round(q * 100):02d}": pl.Float64 for q in QUANTILES},
    })
    return (
        bins.group_by(SNAPSHOT_KEYS, maintain_order=True)
        .agg("bin_lower", "bin_upper", "prob", n_bins=pl.len())
        .with_columns(
            stats=pl.struct("series_ticker", "bin_lower", "bin_upper", "prob").map_elements(
                lambda r: distribution_stats(
                    list(r["bin_lower"]), list(r["bin_upper"]), list(r["prob"]),
                    RESOLUTION.get(r["series_ticker"], 0.0),
                ),
                return_dtype=stat_type,
            )
        )
        .select([*SNAPSHOT_KEYS, "n_bins", "stats"])
        .unnest("stats")
    )


def with_week_ago(bins: pl.DataFrame) -> pl.DataFrame:
    """Add prob_t168: the same bin's probability in the event's T-168h snapshot.

    Null when the event has no T-168h snapshot or that snapshot had no such bin (a strike
    listed later in the week).
    """
    week_ago = bins.filter(pl.col("hours_before_close") == WINDOW_HOURS).select(
        "event_ticker", "bin_lower", "bin_upper", prob_t168="prob"
    )
    return bins.join(
        week_ago, on=["event_ticker", "bin_lower", "bin_upper"], how="left", nulls_equal=True
    )


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
    tables = {
        "contract_prices": prices,
        "implied_survival": survival,
        "implied_bins": with_week_ago(bins),
        "implied_stats": implied_stats(bins),
    }
    for name, df in tables.items():
        df.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    return {name: df.height for name, df in tables.items()}
