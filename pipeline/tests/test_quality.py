from datetime import UTC, date, datetime, timedelta

import duckdb
import polars as pl

from macro_event_lab.quality import run_checks

T0 = datetime(2026, 1, 1, tzinfo=UTC)
UTC_TS = pl.Datetime("us", "UTC")


def _observations(rows: list[tuple[str, date, float | None]]) -> pl.DataFrame:
    return pl.DataFrame(
        rows, schema={"series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64},
        orient="row",
    ).with_columns(
        realtime_start=pl.lit(date(2026, 10, 14)), realtime_end=pl.lit(None, dtype=pl.Date)
    )


def _markets(rows: list[tuple[str, str | None, float | None]]) -> pl.DataFrame:
    return pl.DataFrame(
        rows, schema={"ticker": pl.String, "strike_type": pl.String, "floor_strike": pl.Float64},
        orient="row",
    ).with_columns(
        series_ticker=pl.lit("KXCPI"), event_ticker=pl.lit("E"),
        cap_strike=pl.lit(None, dtype=pl.Float64),
    )


def _candles(rows: list[tuple[str, int, float, float, float | None]]) -> pl.DataFrame:
    return pl.DataFrame(
        [(t, T0 + timedelta(hours=h), bid, ask, px, px) for t, h, bid, ask, px in rows],
        schema={"ticker": pl.String, "end_period_ts": UTC_TS, "yes_bid_close": pl.Float64,
                "yes_ask_close": pl.Float64, "price_close": pl.Float64, "price_mean": pl.Float64},
        orient="row",
    )


def _calendar() -> pl.DataFrame:
    return pl.DataFrame({"release": ["cpi"], "release_date": [date(2026, 10, 14)]})


def _con(obs, markets, candles, calendar=None) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.register("alfred_observations", obs)
    con.register("kalshi_markets", markets)
    con.register("kalshi_candles", candles)
    con.register("release_calendar", _calendar() if calendar is None else calendar)
    return con


def _by_name(con) -> dict:
    return {r.check.name: r for r in run_checks(con)}


def test_clean_data_passes_every_check():
    results = _by_name(_con(
        _observations([
            ("CPIAUCSL", date(2026, 7, 1), 332.8), ("CPIAUCSL", date(2026, 8, 1), 334.1),
            ("GDPC1", date(2026, 1, 1), 24300.0), ("GDPC1", date(2026, 4, 1), 24408.0),
        ]),
        _markets([("KXCPI-26OCT-T0.3", "greater", 0.3)]),
        _candles([
            ("KXCPI-26OCT-T0.3", 1, 0.40, 0.42, None), ("KXCPI-26OCT-T0.3", 2, 0.41, 0.43, 0.42),
        ]),
    ))
    assert {name: r.status for name, r in results.items()} == dict.fromkeys(results, "PASS")


def test_each_check_flags_exactly_the_planted_rows():
    results = _by_name(_con(
        _observations([
            ("CPIAUCSL", date(2025, 9, 1), 324.2),
            ("CPIAUCSL", date(2025, 10, 1), None),  # published as missing
            # 2025-11 has no row at all
            ("CPIAUCSL", date(2025, 12, 1), 325.5),
            ("GDPC1", date(2026, 1, 1), 24300.0),
            ("GDPC1", date(2026, 4, 1), 24408.0),  # quarterly: Feb and Mar are not gaps
        ]),
        _markets([
            ("KXCPI-26OCT-T0.3", "greater", 0.3),
            ("KXCPI-26OCT-T0.3", "greater", 0.3),  # duplicate ticker
            ("CPI-22NOV-T0.0", None, None),  # legacy market, strike only in the ticker
        ]),
        _candles([
            ("A", 1, 0.40, 0.42, 0.41),
            ("A", 2, 0.45, 0.43, None),  # bid above ask
            ("A", 3, 0.40, 1.20, None),  # ask above 1
        ]),
    ))

    missing = results["missing_observations"]
    assert missing.status == "WARN"
    assert missing.problems.select("observation_date", "problem").rows() == [
        (date(2025, 10, 1), "null value"), (date(2025, 11, 1), "no row"),
    ]
    assert results["duplicates_kalshi_markets"].status == "FAIL"
    assert results["duplicates_kalshi_markets"].problems["copies"].to_list() == [2]
    assert results["bid_above_ask"].problems["end_period_ts"].to_list() == [
        T0 + timedelta(hours=2)
    ]
    assert results["price_out_of_range"].problems["yes_ask_close"].to_list() == [1.2]
    assert results["market_missing_strike"].status == "WARN"
    assert results["market_missing_strike"].problems["ticker"].to_list() == ["CPI-22NOV-T0.0"]
    assert results["duplicates_alfred_observations"].status == "PASS"


def test_checks_on_tables_not_built_yet_are_skipped():
    con = duckdb.connect()
    con.register("kalshi_candles", _candles([("A", 1, 0.40, 0.42, 0.41)]))
    results = _by_name(con)
    assert results["missing_observations"].status == "SKIP"
    assert results["bid_above_ask"].status == "PASS"
