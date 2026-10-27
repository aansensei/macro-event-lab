from datetime import UTC, datetime

import httpx
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.raw_store import save_raw
from macro_event_lab.sources.kalshi import (
    fetched_candle_windows,
    ingest_candles,
    parse_candles,
    parse_markets,
    time_chunks,
)

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


def test_unsettled_market_result_is_null_not_empty_string():
    # Live Kalshi markets carry result="" and expiration_value="" until settlement
    payload = {"markets": [{
        "ticker": "KXCPI-26OCT-T1.0", "status": "active", "result": "", "expiration_value": "",
    }]}
    row = parse_markets("KXCPI", payload)[0]
    assert row["result"] is None
    assert row["expiration_value"] is None


def test_fetched_candle_windows_only_counts_closed_windows(tmp_path):
    fetched_at = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)
    now_ts = int(fetched_at.timestamp())
    closed = {"start_ts": now_ts - 20 * 3600, "end_ts": now_ts - 10 * 3600, "period_interval": 60}
    still_open = {"start_ts": now_ts - 3600, "end_ts": now_ts + 3600, "period_interval": 60}
    for params in (closed, still_open):
        save_raw(tmp_path, "kalshi.candles", "u", params, b'{"candlesticks": []}',
                 {"series_ticker": "KXCPI", "ticker": "T1"}, fetched_at)
    save_raw(tmp_path, "kalshi.markets", "u", {}, b'{"markets": []}', {}, fetched_at)

    assert fetched_candle_windows(tmp_path) == {
        ("T1", closed["start_ts"], closed["end_ts"], 60)
    }


class _RecordingClient:
    def __init__(self):
        self.calls = []

    def get(self, path, params=None):
        self.calls.append(params)
        request = httpx.Request("GET", f"https://example.test{path}")
        return httpx.Response(200, json={"candlesticks": []}, request=request)


def test_ingest_candles_skips_windows_already_fetched(tmp_path):
    market = {
        "ticker": "T1", "open_time": "2026-06-01T00:00:00Z", "close_time": "2026-06-25T00:00:00Z",
    }
    client = _RecordingClient()
    first = ingest_candles(client, tmp_path, "KXCPI", market, historical=True)
    assert first == 3  # 24 days in 10-day windows

    skip = {(
        "T1", client.calls[0]["start_ts"], client.calls[0]["end_ts"], 60,
    )}
    client.calls.clear()
    second = ingest_candles(client, tmp_path, "KXCPI", market, historical=True, skip=skip)
    assert second == 2
    assert all(c["start_ts"] != min(s[1] for s in skip) for c in client.calls)


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
