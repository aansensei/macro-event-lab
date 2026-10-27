from datetime import UTC, datetime, timedelta

import polars as pl
import pytest

from macro_event_lab.config import Paths
from macro_event_lab.gold import build_gold, contract_prices

T0 = datetime(2026, 10, 1, tzinfo=UTC)
CANDLE_SCHEMA = {
    "ticker": pl.String, "end_period_ts": pl.Datetime("us", "UTC"),
    "yes_bid_close": pl.Float64, "yes_ask_close": pl.Float64, "price_close": pl.Float64,
}


def _candles(rows: list[tuple[float, float, float | None]]) -> pl.DataFrame:
    data = [("T", T0 + timedelta(hours=i), *row) for i, row in enumerate(rows)]
    return pl.DataFrame(data, schema=CANDLE_SCHEMA, orient="row")


@pytest.mark.parametrize(
    ("bid", "ask", "trade", "price", "source"),
    [
        (0.41, 0.44, None, 0.425, "mid"),  # tight book: mid even without a trade
        (0.45, 0.55, 0.50, 0.50, "mid"),  # exactly 10 cents despite floating point
        (0.20, 0.80, 0.43, 0.43, "trade"),  # too wide: last trade instead
        (0.02, 0.98, None, None, None),  # too wide and no trade: no price
        (0.22, 0.21, 0.21, 0.21, "trade"),  # crossed (stale bid): never a mid
        (0.22, 0.21, None, None, None),  # crossed and no trade: no price
        (0.00, 0.03, None, 0.015, "mid"),  # bid 0 means nobody bids; still a usable tail
    ],
)
def test_contract_price_rule(bid, ask, trade, price, source):
    row = contract_prices(_candles([(bid, ask, trade)])).row(0, named=True)
    assert row["price_source"] == source
    assert row["price"] == pytest.approx(price) if price is not None else row["price"] is None


def test_build_gold_writes_contract_prices(tmp_path):
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    _candles([(0.41, 0.44, None), (0.02, 0.98, None)]).write_parquet(
        paths.silver / "kalshi_candles.parquet"
    )

    assert build_gold(paths) == {"contract_prices": 2}
    out = pl.read_parquet(paths.gold / "contract_prices.parquet")
    assert out["price_source"].to_list() == ["mid", None]
