"""Gold layer: tables derived from silver for analysis and the website.

contract_prices turns each hourly Kalshi candle into one usable YES price: the bid/ask mid
when the book is sane and tight, else the last trade, else nothing.
"""

from __future__ import annotations

import polars as pl

from macro_event_lab.config import Paths

# In the 7 days before a market closes, 96 to 99.7% of candles have a spread of at most
# 10 cents (median 1 to 2 cents), so a wider book no longer says where the price is.
MAX_SPREAD = 0.10


def contract_prices(candles: pl.DataFrame) -> pl.DataFrame:
    """One price per (ticker, end_period_ts) with its source: "mid", "trade" or null.

    A crossed book (bid above ask, e.g. the stale bids listed in quality.KNOWN_ANOMALIES)
    never yields a mid; it falls back to the trade price like a too-wide book does.
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
        )
        .sort("ticker", "end_period_ts")
    )


def build_gold(paths: Paths) -> dict[str, int]:
    candles = pl.read_parquet(paths.silver / "kalshi_candles.parquet")
    paths.gold.mkdir(parents=True, exist_ok=True)
    prices = contract_prices(candles)
    prices.write_parquet(paths.gold / "contract_prices.parquet", compression="zstd")
    return {"contract_prices": prices.height}
