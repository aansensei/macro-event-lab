from datetime import UTC, date, datetime, timedelta

import duckdb
import polars as pl
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from macro_event_lab.pit import alfred_as_of, attach_known_from, kalshi_as_of

T0 = datetime(2026, 1, 1, tzinfo=UTC)
UTC_TS = pl.Datetime("us", "UTC")


def _calendar(rows: list[tuple[str, date, datetime]]) -> pl.DataFrame:
    return pl.DataFrame(
        rows, schema={"release": pl.String, "release_date": pl.Date, "release_ts": UTC_TS},
        orient="row",
    )


def test_known_from_uses_release_time_or_end_of_day():
    obs = pl.DataFrame({
        "series_id": ["CPIAUCSL", "CPIAUCSL"],
        "observation_date": [date(2026, 8, 1), date(2025, 8, 1)],
        "value": [334.1, 323.3],
        "realtime_start": [date(2026, 9, 11), date(2026, 2, 15)],
    })
    calendar = _calendar([("cpi", date(2026, 9, 11), datetime(2026, 9, 11, 12, 30, tzinfo=UTC))])

    out = attach_known_from(obs, calendar).sort("realtime_start")

    # 2026-02-15 (a Sunday) is not in this calendar: assume the end of that New York day (EST)
    assert out["known_from"].to_list() == [
        datetime(2026, 2, 16, 4, 59, 59, tzinfo=UTC),
        datetime(2026, 9, 11, 12, 30, tzinfo=UTC),
    ]
    assert out["known_from_source"].to_list() == ["date_end_of_day", "release_calendar"]


def _alfred_con(rows: list[tuple[str, date, float, datetime]]) -> duckdb.DuckDBPyConnection:
    df = pl.DataFrame(
        rows,
        schema={"series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
                "known_from": UTC_TS},
        orient="row",
    ).with_columns(
        realtime_start=pl.col("known_from").dt.date(), known_from_source=pl.lit("test")
    )
    con = duckdb.connect()
    con.register("alfred_observations", df)
    return con


def test_alfred_as_of_picks_vintage_public_at_that_moment():
    first, revised = T0, T0 + timedelta(days=30)
    con = _alfred_con([
        ("CPIAUCSL", date(2025, 12, 1), 330.0, first),
        ("CPIAUCSL", date(2025, 12, 1), 330.5, revised),
    ])
    assert alfred_as_of(con, first - timedelta(seconds=1)).is_empty()  # not published yet
    assert alfred_as_of(con, first)["value"].to_list() == [330.0]  # public at that instant
    assert alfred_as_of(con, revised + timedelta(days=1))["value"].to_list() == [330.5]


def test_as_of_rejects_naive_timestamps():
    with pytest.raises(ValueError):
        alfred_as_of(_alfred_con([]), datetime(2026, 1, 1))


vintage = st.tuples(
    st.sampled_from(["A", "B"]),
    st.integers(min_value=0, max_value=3),  # observation index
    st.integers(min_value=0, max_value=1000),  # known_from, hours after T0
)


@settings(max_examples=200, deadline=None)
@given(vintages=st.lists(vintage, max_size=30, unique_by=lambda v: v), hours=st.integers(-5, 1005))
def test_alfred_as_of_never_looks_ahead(vintages, hours):
    rows = [
        (s, date(2025, 1 + i, 1), float(h), T0 + timedelta(hours=h)) for s, i, h in vintages
    ]
    ts = T0 + timedelta(hours=hours)
    got = alfred_as_of(_alfred_con(rows), ts)

    # Nothing published after ts, ever
    assert all(k <= ts for k in got["known_from"].to_list())
    # And exactly the newest vintage public at ts for every observation (brute force check)
    expected = {}
    for s, obs_date, value, known in rows:
        if known <= ts and ((s, obs_date) not in expected or known > expected[(s, obs_date)][1]):
            expected[(s, obs_date)] = (value, known)
    assert {
        (r["series_id"], r["observation_date"]): (r["value"], r["known_from"])
        for r in got.iter_rows(named=True)
    } == expected


def _kalshi_con() -> duckdb.DuckDBPyConnection:
    markets = pl.DataFrame({
        "ticker": ["OPEN", "CLOSED"],
        "event_ticker": ["E", "E"],
        "series_ticker": ["KXCPI", "KXCPI"],
        "strike_type": ["greater", "greater"],
        "floor_strike": [0.3, 0.2],
        "cap_strike": [None, None],
        "open_time": [T0, T0],
        "close_time": [T0 + timedelta(days=10), T0 + timedelta(days=2)],
        "result": [None, "yes"],
    }, schema_overrides={"cap_strike": pl.Float64, "open_time": UTC_TS, "close_time": UTC_TS})
    candles = pl.DataFrame({
        "ticker": ["OPEN", "OPEN", "OPEN", "CLOSED"],
        "end_period_ts": [T0 + timedelta(hours=h) for h in (1, 5, 100)] + [T0 + timedelta(hours=1)],
        "yes_bid_close": [0.40, 0.45, 0.90, 0.50],
        "yes_ask_close": [0.42, 0.47, 0.92, 0.52],
        "price_close": [None, 0.46, 0.91, None],
        "volume": [0.0, 10.0, 5.0, 0.0],
        "open_interest": [1.0, 2.0, 3.0, 4.0],
    }, schema_overrides={"end_period_ts": UTC_TS, "price_close": pl.Float64})
    con = duckdb.connect()
    con.register("kalshi_markets", markets)
    con.register("kalshi_candles", candles)
    return con


def test_kalshi_as_of_uses_last_finished_candle_of_open_markets():
    got = kalshi_as_of(_kalshi_con(), T0 + timedelta(days=3))
    assert got["ticker"].to_list() == ["OPEN"]  # CLOSED had closed by then
    assert got["yes_bid_close"].to_list() == [0.45]  # the 100-hour candle is in the future
    assert "result" not in got.columns  # settlement outcome is future information
