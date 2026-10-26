from datetime import UTC, datetime

from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.sources.kalshi import parse_candles, parse_markets, time_chunks

LIVE_CANDLES = {
    "ticker": "KXCPI-26SEP-T0.3",
    "candlesticks": [
        {
            "end_period_ts": 1760000400,
            "yes_bid": {"close_dollars": "0.4100"},
            "yes_ask": {"close_dollars": "0.4400"},
            "price": {"close_dollars": "0.4300", "mean_dollars": None},
            "volume_fp": "120.00",
            "open_interest_fp": "900.00",
        }
    ],
}

HISTORICAL_CANDLES = {
    "ticker": "KXCPI-24JAN-T0.3",
    "candlesticks": [
        {
            "end_period_ts": 1705000000,
            "yes_bid": {"close": "0.20"},
            "yes_ask": {"close": "0.25"},
            "price": {"close": None, "mean": None},
            "volume": "0.00",
            "open_interest": "50.00",
        }
    ],
}


def test_live_candle_fields():
    row = parse_candles(LIVE_CANDLES)[0]
    assert row["ticker"] == "KXCPI-26SEP-T0.3"
    assert row["end_period_ts"] == datetime.fromtimestamp(1760000400, UTC)
    assert (row["yes_bid_close"], row["yes_ask_close"]) == (0.41, 0.44)
    assert row["price_mean"] is None
    assert row["volume"] == 120.0


def test_historical_candle_fields():
    row = parse_candles(HISTORICAL_CANDLES)[0]
    assert (row["yes_bid_close"], row["yes_ask_close"]) == (0.20, 0.25)
    assert row["price_close"] is None  # no trade in that hour
    assert row["open_interest"] == 50.0


def test_market_strikes():
    payload = {"markets": [{
        "ticker": "KXPAYROLLS-26AUG-T200000", "event_ticker": "KXPAYROLLS-26AUG",
        "strike_type": "greater", "floor_strike": 200000, "cap_strike": None,
        "open_time": "2026-08-01T14:00:00Z", "close_time": "2026-09-04T12:29:00Z",
        "result": "no", "expiration_value": "162000",
    }]}
    row = parse_markets("KXPAYROLLS", payload)[0]
    assert row["floor_strike"] == 200000.0
    assert row["cap_strike"] is None
    assert row["close_time"] == datetime(2026, 9, 4, 12, 29, tzinfo=UTC)


@given(
    start=st.integers(min_value=0, max_value=2_000_000_000),
    length=st.integers(min_value=0, max_value=200 * 24 * 3600),
    size=st.integers(min_value=3600, max_value=30 * 24 * 3600),
)
def test_time_chunks_cover_range_without_gaps(start, length, size):
    end = start + length
    chunks = time_chunks(start, end, size)
    assert chunks[0][0] == start
    assert chunks[-1][1] == end
    for (_lo, hi), (next_lo, _) in zip(chunks, chunks[1:], strict=False):
        assert hi + 1 == next_lo  # no gap, no overlap
    assert all(hi - lo + 1 <= size for lo, hi in chunks)
