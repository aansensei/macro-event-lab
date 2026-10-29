from datetime import UTC, date, datetime, timedelta

import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.config import Paths
from macro_event_lab.gold import (
    bin_intervals,
    bins_from_survival,
    brier_score,
    build_gold,
    contract_prices,
    crps_piecewise,
    distribution_stats,
    event_insights,
    event_surprises,
    first_prints,
    forecast_scores,
    implied_distributions,
    implied_stats,
    in_kalshi_units,
    isotonic_decreasing,
    latest_per_release,
    pit_value,
    reference_period_from_event,
    release_industry_returns,
    release_reactions,
    revisions,
    with_week_ago,
)

T0 = datetime(2026, 10, 1, tzinfo=UTC)
CANDLE_SCHEMA = {
    "ticker": pl.String, "end_period_ts": pl.Datetime("us", "UTC"),
    "yes_bid_close": pl.Float64, "yes_ask_close": pl.Float64, "price_close": pl.Float64,
}


def _candles(rows: list[tuple[float, float, float | None]]) -> pl.DataFrame:
    data = [("T", T0 + timedelta(hours=i), *row) for i, row in enumerate(rows)]
    return pl.DataFrame(data, schema=CANDLE_SCHEMA, orient="row")


@pytest.mark.parametrize(
    ("bid", "ask", "trade", "price", "source", "weight"),
    [
        (0.41, 0.44, None, 0.425, "mid", 1 / 0.03),  # tight book: mid even without a trade
        (0.45, 0.55, 0.50, 0.50, "mid", 10.0),  # exactly 10 cents despite floating point
        (0.50, 0.50, None, 0.50, "mid", 100.0),  # locked book counts as 1 cent wide
        (0.20, 0.80, 0.43, 0.43, "trade", 1 / 0.60),  # too wide: last trade, low weight
        (0.02, 0.98, None, None, None, None),  # too wide and no trade: no price
        (0.22, 0.21, 0.21, 0.21, "trade", 10.0),  # crossed: trade, never above a 10 cent mid
        (0.22, 0.21, None, None, None, None),  # crossed and no trade: no price
        (0.00, 0.03, None, 0.015, "mid", 1 / 0.03),  # bid 0 means nobody bids; a usable tail
    ],
)
def test_contract_price_rule(bid, ask, trade, price, source, weight):
    row = contract_prices(_candles([(bid, ask, trade)])).row(0, named=True)
    assert row["price_source"] == source
    for key, expected in (("price", price), ("weight", weight)):
        assert row[key] == pytest.approx(expected) if expected is not None else row[key] is None


CLOSE = datetime(2026, 10, 14, 12, 29, tzinfo=UTC)
MARKET_SCHEMA = {
    "series_ticker": pl.String, "event_ticker": pl.String, "ticker": pl.String,
    "strike_type": pl.String, "floor_strike": pl.Float64, "close_time": pl.Datetime("us", "UTC"),
    "expiration_value": pl.String, "result": pl.String,
}
PRICE_SCHEMA = {
    "ticker": pl.String, "end_period_ts": pl.Datetime("us", "UTC"), "price": pl.Float64,
    "weight": pl.Float64,
}


def _markets(strikes: dict[str, float]) -> pl.DataFrame:
    rows = [("KXCPI", "E", t, "greater", k, CLOSE, None, None) for t, k in strikes.items()]
    return pl.DataFrame(rows, schema=MARKET_SCHEMA, orient="row")


def _prices(rows: list[tuple[str, int, float]], weight: float = 100.0) -> pl.DataFrame:
    # (ticker, hours before the 12:00 anchor, price), all with the same weight
    anchor = CLOSE.replace(minute=0)
    data = [(t, anchor - timedelta(hours=h), p, weight) for t, h, p in rows]
    return pl.DataFrame(data, schema=PRICE_SCHEMA, orient="row")


def test_build_gold_writes_all_tables(tmp_path):
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    _candles([(0.41, 0.44, None), (0.02, 0.98, None)]).write_parquet(
        paths.silver / "kalshi_candles.parquet"
    )
    _markets({"T": 0.3}).write_parquet(paths.silver / "kalshi_markets.parquet")
    _observations([]).write_parquet(paths.silver / "alfred_observations.parquet")

    counts = build_gold(paths)

    assert counts["contract_prices"] == 2
    out = pl.read_parquet(paths.gold / "contract_prices.parquet")
    assert out["price_source"].to_list() == ["mid", None]
    assert (paths.gold / "implied_bins.parquet").exists()
    assert (paths.gold / "event_surprise.parquet").exists()


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ([0.9, 0.6, 0.2], [0.9, 0.6, 0.2]),  # already non-increasing
        ([0.9, 0.5, 0.6, 0.1], [0.9, 0.55, 0.55, 0.1]),  # one violation is pooled
        ([0.2, 0.4, 0.6], [0.4, 0.4, 0.4]),  # fully reversed collapses to the mean
        ([1.2, -0.1], [1.0, 0.0]),  # clipped to probabilities
    ],
)
def test_isotonic_decreasing_examples(values, expected):
    assert isotonic_decreasing(values) == pytest.approx(expected)


prob_lists = st.lists(st.floats(min_value=0, max_value=1), min_size=1, max_size=25)


@given(prob_lists)
def test_isotonic_is_non_increasing_and_keeps_the_mean(values):
    fitted = isotonic_decreasing(values)
    assert len(fitted) == len(values)
    assert all(a >= b - 1e-12 for a, b in zip(fitted, fitted[1:], strict=False))
    assert sum(fitted) == pytest.approx(sum(values))


def test_low_weight_outlier_barely_moves_its_neighbours():
    # a 0.51 price on a 10 cent book among 0.99 prices on 1 cent books
    values, weights = [0.51, 0.99, 0.99], [10.0, 100.0, 100.0]
    unweighted = isotonic_decreasing(values)
    weighted = isotonic_decreasing(values, weights)
    assert unweighted == pytest.approx([0.83, 0.83, 0.83])
    assert weighted == pytest.approx([(0.51 * 10 + 0.99 * 200) / 210] * 3)
    assert weighted[1] > 0.96


@given(st.lists(
    st.tuples(st.floats(min_value=0, max_value=1), st.floats(min_value=0.5, max_value=100)),
    min_size=1, max_size=25,
))
def test_weighted_isotonic_is_non_increasing_and_keeps_the_weighted_mean(pairs):
    values, weights = [v for v, _ in pairs], [w for _, w in pairs]
    fitted = isotonic_decreasing(values, weights)
    assert all(a >= b - 1e-9 for a, b in zip(fitted, fitted[1:], strict=False))
    assert sum(f * w for f, w in zip(fitted, weights, strict=True)) == pytest.approx(
        sum(v * w for v, w in zip(values, weights, strict=True))
    )


@given(prob_lists)
def test_bins_are_non_negative_and_sum_to_one(values):
    survival = isotonic_decreasing(values)
    strikes = [float(i) / 10 for i in range(len(survival))]
    bins = bins_from_survival(strikes, survival)
    assert len(bins) == len(survival) + 1
    assert all(p >= -1e-12 for _, _, p in bins)
    assert sum(p for _, _, p in bins) == pytest.approx(1.0)
    assert bins[0][0] is None and bins[-1][1] is None


def test_snapshots_use_only_prices_known_at_each_hour():
    markets = _markets({"T0.2": 0.2, "T0.3": 0.3})
    prices = _prices([
        ("T0.2", 3, 0.70), ("T0.2", 1, 0.60),
        ("T0.3", 2, 0.80),  # above the lower strike's price: an order violation
    ])

    survival, bins = implied_distributions(markets, prices)
    at = {h: g for (h,), g in survival.partition_by("hours_before_close", as_dict=True).items()}

    # the last price is 1h before the anchor, so the 0h snapshot lies after the data and is dropped
    assert sorted(at) == [1, 2, 3]
    assert at[3]["ticker"].to_list() == ["T0.2"]  # T0.3 had no price yet
    assert at[2]["survival"].to_list() == pytest.approx([0.75, 0.75])  # pooled
    assert at[1]["price"].to_list() == [0.60, 0.80]  # T0.3 carries its 2h-old price
    assert at[1]["price_age_h"].to_list() == [0, 1]
    for (_,), g in bins.partition_by("hours_before_close", as_dict=True).items():
        assert g["prob"].sum() == pytest.approx(1.0)


CPI_LOWERS = [None, 0.2, 0.3, 0.4]
CPI_UPPERS = [0.2, 0.3, 0.4, None]


def test_cpi_bins_centre_on_the_published_value():
    # (0.3, 0.4] can only be published as 0.4, so its interval centres on 0.4, not 0.35
    intervals = bin_intervals(CPI_LOWERS, CPI_UPPERS, 0.1)
    flat = [x for pair in intervals for x in pair]
    assert flat == pytest.approx([0.15, 0.25, 0.25, 0.35, 0.35, 0.45, 0.45, 0.55])


def test_stats_of_a_single_bin_distribution():
    stats = distribution_stats(CPI_LOWERS, CPI_UPPERS, [0.0, 0.0, 1.0, 0.0], 0.1)
    assert stats["mean"] == pytest.approx(0.4)
    assert stats["sd"] == pytest.approx(0.1 / 12**0.5)
    assert (stats["p05"], stats["p50"], stats["p95"]) == pytest.approx((0.355, 0.4, 0.445))


def test_open_tail_is_as_wide_as_the_strike_gap():
    # payrolls: strikes 100k and 150k, half the mass above 150k
    stats = distribution_stats(
        [None, 100000.0, 150000.0], [100000.0, 150000.0, None], [0.0, 0.5, 0.5], 1000.0
    )
    assert stats["p50"] == pytest.approx(150500.0)
    assert stats["mean"] == pytest.approx(150500.0)


def test_one_strike_is_not_a_distribution():
    stats = distribution_stats([None, 0.3], [0.3, None], [0.4, 0.6], 0.1)
    assert all(v is None for v in stats.values())


@given(st.lists(st.floats(min_value=0, max_value=1), min_size=2, max_size=15))
def test_quantiles_are_ordered_and_inside_the_support(values):
    survival = isotonic_decreasing(values)
    strikes = [round(0.1 * i, 1) for i in range(len(survival))]
    bins = bins_from_survival(strikes, survival)
    lowers, uppers, probs = (list(x) for x in zip(*bins, strict=True))
    stats = distribution_stats(lowers, uppers, probs, 0.1)
    qs = [stats[k] for k in ("p05", "p25", "p50", "p75", "p95")]
    intervals = bin_intervals(lowers, uppers, 0.1)
    assert all(a <= b + 1e-9 for a, b in zip(qs, qs[1:], strict=False))
    assert intervals[0][0] - 1e-9 <= stats["mean"] <= intervals[-1][1] + 1e-9
    assert stats["sd"] >= 0


def _bins(rows: list[tuple[int, float | None, float | None, float]]) -> pl.DataFrame:
    # (hours before close, lower, upper, prob) for one CPI event
    return pl.DataFrame(
        [("KXCPI", "E", CLOSE - timedelta(hours=h), h, lo, hi, p) for h, lo, hi, p in rows],
        schema={"series_ticker": pl.String, "event_ticker": pl.String,
                "ts": pl.Datetime("us", "UTC"), "hours_before_close": pl.Int64,
                "bin_lower": pl.Float64, "bin_upper": pl.Float64, "prob": pl.Float64},
        orient="row",
    )


def test_week_ago_probability_matches_bins_including_open_ends():
    bins = _bins([
        (168, None, 0.3, 0.6), (168, 0.3, None, 0.4),
        (1, None, 0.3, 0.2), (1, 0.3, 0.4, 0.5), (1, 0.4, None, 0.3),  # 0.4 strike listed later
    ])
    out = with_week_ago(bins).filter(pl.col("hours_before_close") == 1).sort(
        "bin_upper", nulls_last=True
    )
    assert out["prob_t168"].to_list() == [0.6, None, None]


def test_implied_stats_one_row_per_snapshot():
    bins = _bins([(1, None, 0.2, 0.0), (1, 0.2, 0.3, 0.0), (1, 0.3, 0.4, 1.0), (1, 0.4, None, 0.0)])
    stats = implied_stats(bins)
    assert stats.height == 1
    assert stats["n_bins"][0] == 4
    assert stats["mean"][0] == pytest.approx(0.4)


OBS_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}


def _observations(rows: list[tuple]) -> pl.DataFrame:
    # (series_id, observation_date, value, realtime_start, realtime_end or None)
    return pl.DataFrame(rows, schema=OBS_SCHEMA, orient="row")


def test_revisions_follow_a_period_from_release_day_to_the_current_vintage():
    d = date
    obs = _observations([
        ("PAYEMS", d(2026, 5, 1), 1000.0, d(2026, 6, 5), None),
        ("PAYEMS", d(2026, 6, 1), 1100.0, d(2026, 7, 2), d(2026, 8, 6)),
        ("PAYEMS", d(2026, 6, 1), 1120.0, d(2026, 8, 7), d(2026, 9, 3)),  # revised in July's report
        ("PAYEMS", d(2026, 6, 1), 1150.0, d(2026, 9, 4), None),  # and again in August's
        ("PAYEMS", d(2026, 7, 1), 1200.0, d(2026, 8, 7), None),
        ("PAYEMS", d(2026, 8, 1), 1300.0, d(2026, 9, 4), None),
    ])

    out = {
        r["reference_period"]: r
        for r in revisions(obs, since=d(2026, 1, 1)).iter_rows(named=True)
    }

    assert set(out) == {d(2026, 6, 1), d(2026, 7, 1), d(2026, 8, 1)}  # May has no April level
    june = out[d(2026, 6, 1)]
    assert (june["first_print"], june["next_print"], june["latest_print"]) == (
        100000.0, 120000.0, 150000.0
    )
    assert june["next_release_date"] == d(2026, 8, 7)
    july = out[d(2026, 7, 1)]  # both levels move together: 1200 against June as revised
    assert (july["first_print"], july["next_print"], july["latest_print"]) == (
        80000.0, 50000.0, 50000.0
    )
    august = out[d(2026, 8, 1)]  # published in the newest vintage: nothing later yet
    assert august["next_release_date"] is None
    assert august["next_print"] is None
    assert august["first_print"] == august["latest_print"] == 100000.0
    assert {r["latest_vintage"] for r in out.values()} == {d(2026, 9, 4)}


def test_values_in_kalshi_units():
    assert in_kalshi_units("KXCPI", 101.0, 100.0) == 1.0
    assert in_kalshi_units("KXPAYROLLS", 159044.0, 158900.0) == 144000.0
    assert in_kalshi_units("KXGDP", 101.0, 100.0) == 4.1


def test_first_print_uses_the_previous_period_as_revised_on_release_day():
    d = date
    obs = _observations([
        ("CPIAUCSL", d(2026, 7, 1), 329.0, d(2026, 8, 12), None),
        ("CPIAUCSL", d(2026, 8, 1), 330.0, d(2026, 9, 11), d(2026, 10, 13)),
        ("CPIAUCSL", d(2026, 8, 1), 333.0, d(2026, 10, 14), None),  # August revised with September
        ("CPIAUCSL", d(2026, 9, 1), 336.33, d(2026, 10, 14), None),
    ])
    fp = first_prints(obs).filter(pl.col("series_ticker") == "KXCPI")
    by_day = dict(zip(fp["release_date"].to_list(), fp["first_print"].to_list(), strict=True))
    assert by_day[d(2026, 9, 11)] == 0.3  # 330 / 329
    assert by_day[d(2026, 10, 14)] == 1.0  # 336.33 / 333, not / 330


def test_a_skipped_month_leaves_the_next_first_print_empty():
    d = date
    obs = _observations([
        ("CPIAUCSL", d(2025, 9, 1), 324.2, d(2025, 10, 24), None),
        ("CPIAUCSL", d(2025, 10, 1), None, d(2025, 12, 18), None),  # never published
        ("CPIAUCSL", d(2025, 11, 1), 325.0, d(2025, 12, 18), None),
    ])
    prints = first_prints(obs)
    assert prints.filter(pl.col("release_date") == d(2025, 12, 18)).height == 2
    row = latest_per_release(prints).filter(pl.col("release_date") == d(2025, 12, 18)).row(
        0, named=True
    )
    assert row["reference_period"] == d(2025, 11, 1)  # the latest observation of that release
    assert row["first_print"] is None


def _event_markets(rows: list[tuple[str, str, datetime, str | None]]) -> pl.DataFrame:
    # (series_ticker, event_ticker, close_time, expiration_value)
    data = [(s, e, f"{e}-T", "greater", 0.0, c, v, None) for s, e, c, v in rows]
    return pl.DataFrame(data, schema=MARKET_SCHEMA, orient="row")


def _fomc_ladder(event: str, value: str, yes_up_to: float | None) -> list[tuple]:
    # KXFED strikes 3.25 to 4.25; markets at or below yes_up_to resolved yes (rate above the strike)
    close = datetime(2026, 1, 28, 18, 55, tzinfo=UTC)
    return [
        ("KXFED", event, f"{event}-T{k:.2f}", "greater", k, close, value,
         "yes" if yes_up_to is not None and k <= yes_up_to else "no")
        for k in (3.25, 3.50, 3.75, 4.00, 4.25)
    ]


def test_descriptive_fomc_settlements_are_read_from_the_strike_results():
    rows = (
        _fomc_ladder("FED-JAN", "Above 3.50%", 3.50)  # yes up to 3.50, no from 3.75: 3.75
        + _fomc_ladder("FED-MAR", "Yes", 3.25)  # yes up to 3.25, no from 3.50: 3.50
        + _fomc_ladder("FED-TOP", "Yes", 4.25)  # every strike yes: above the ladder, unknown
        + _fomc_ladder("FED-NUM", "3.75", 3.25)  # a numeric value wins over the results
    )
    markets = pl.DataFrame(rows, schema=MARKET_SCHEMA, orient="row")
    stats = pl.DataFrame(
        {"event_ticker": [], "hours_before_close": [], "mean": [], "sd": []},
        schema={"event_ticker": pl.String, "hours_before_close": pl.Int64,
                "mean": pl.Float64, "sd": pl.Float64},
    )

    out = event_surprises(markets, _observations([]), stats)
    value = dict(zip(out["event_ticker"].to_list(), out["first_print"].to_list(), strict=True))

    assert value == {"FED-JAN": 3.75, "FED-MAR": 3.50, "FED-TOP": None, "FED-NUM": 3.75}


def test_strike_results_with_a_gap_wider_than_one_step_give_no_value():
    rows = [
        r for r in _fomc_ladder("FED-GAP", "Yes", 3.25) if not r[2].endswith("T3.50")
    ]  # yes at 3.25, next no at 3.75: 3.50 or 3.75, not one value
    markets = pl.DataFrame(rows, schema=MARKET_SCHEMA, orient="row")
    stats = pl.DataFrame(
        {"event_ticker": ["FED-GAP"], "hours_before_close": [1], "mean": [3.5], "sd": [0.1]}
    )
    row = event_surprises(markets, _observations([]), stats).row(0, named=True)
    assert row["first_print"] is None
    assert row["settled_value"] is None


def test_event_surprise_matches_releases_and_falls_back_for_fomc():
    d = date
    obs = _observations([
        ("CPIAUCSL", d(2026, 8, 1), 333.0, d(2026, 9, 11), None),
        ("CPIAUCSL", d(2026, 9, 1), 336.33, d(2026, 10, 24), None),  # pushed back 9 days
        ("CPIAUCSL", d(2026, 11, 1), 340.0, d(2026, 12, 18), None),
    ])
    markets = _event_markets([
        ("KXCPI", "CPI-SEP", datetime(2026, 10, 15, 12, 29, tzinfo=UTC), "1.0"),
        ("KXCPI", "CPI-OCT", datetime(2026, 11, 13, 13, 29, tzinfo=UTC), None),  # never published
        ("KXFED", "FED-DEC", datetime(2026, 12, 9, 18, 55, tzinfo=UTC), "4.50"),
    ])
    stats = pl.DataFrame({
        "event_ticker": ["CPI-SEP", "CPI-OCT", "FED-DEC"], "hours_before_close": [1, 1, 1],
        "mean": [0.6, 0.3, 4.4], "sd": [0.2, 0.1, 0.1],
    })

    out = {r["event_ticker"]: r for r in event_surprises(markets, obs, stats).iter_rows(named=True)}

    sep = out["CPI-SEP"]
    assert (sep["release_date"], sep["first_print"], sep["first_print_source"]) == (
        d(2026, 10, 24), 1.0, "alfred"
    )
    assert sep["surprise"] == pytest.approx(0.4)
    assert sep["surprise_sd"] == pytest.approx(2.0)
    assert out["CPI-OCT"]["first_print"] is None  # Dec 18 is more than 14 days later
    fed = out["FED-DEC"]
    assert (fed["first_print"], fed["first_print_source"]) == (4.5, "kalshi")
    assert fed["surprise_sd"] == pytest.approx(1.0)


def test_fomc_events_take_the_statement_date_after_the_close():
    markets = _event_markets([
        # legacy market: closed at 19:00 ET two days before the decision
        ("KXFED", "FED-21JUL", datetime(2021, 7, 26, 23, 0, tzinfo=UTC), "0.25"),
        ("KXFED", "FED-DEC", datetime(2026, 12, 9, 18, 55, tzinfo=UTC), "4.50"),
        ("KXFED", "FED-OFF", datetime(2026, 8, 1, 18, 55, tzinfo=UTC), "4.50"),  # no meeting near
    ])
    stats = pl.DataFrame(
        {"event_ticker": [], "hours_before_close": [], "mean": [], "sd": []},
        schema={"event_ticker": pl.String, "hours_before_close": pl.Int64,
                "mean": pl.Float64, "sd": pl.Float64},
    )
    meetings = [date(2021, 6, 16), date(2021, 7, 28), date(2026, 12, 9)]

    out = {
        r["event_ticker"]: r["release_date"]
        for r in event_surprises(markets, _observations([]), stats, meetings).iter_rows(named=True)
    }

    assert out == {"FED-21JUL": date(2021, 7, 28), "FED-DEC": date(2026, 12, 9), "FED-OFF": None}


@pytest.mark.parametrize(
    ("series", "event", "expected"),
    [
        ("KXCPI", "KXCPI-25SEP", date(2025, 9, 1)),
        ("KXCPI", "CPI-21JUN", date(2021, 6, 1)),
        ("KXPAYROLLS", "PROLLS-23DECB", date(2023, 12, 1)),  # second event for the month
        ("KXGDP", "GDP-21JUN30", date(2021, 4, 1)),  # quarter-end date: Q2 2021
        ("KXGDP", "GDP-21DEC31", date(2021, 10, 1)),
        ("KXGDP", "GDP-23APR27", date(2023, 1, 1)),  # release day: the quarter before
        ("KXGDP", "KXGDP-25JAN31", date(2024, 10, 1)),  # January release: Q4 of last year
        ("KXGDP", "KXGDP-25OCT30", date(2025, 7, 1)),
        ("KXGDP", "GDP-232022 Q4", date(2022, 10, 1)),
        ("KXGDP", "KXGDP-25SEP", None),  # GDP needs a day
        ("KXFED", "KXFED-26DEC", None),  # no ALFRED period for the Fed
        ("KXCPI", "KXCPI-NOPERIOD", None),
    ],
)
def test_reference_period_from_event(series, event, expected):
    assert reference_period_from_event(series, event) == expected


def test_shutdown_delays_match_by_period_and_unnamed_tickers_fall_back_to_the_window():
    d = date
    obs = _observations([
        ("PAYEMS", d(2025, 8, 1), 159500.0, d(2025, 9, 5), None),
        ("PAYEMS", d(2025, 9, 1), 159619.0, d(2025, 11, 20), None),  # 48 days after the close
        ("CPIAUCSL", d(2025, 8, 1), 323.0, d(2025, 9, 11), None),
        ("CPIAUCSL", d(2025, 9, 1), 324.0, d(2025, 10, 24), None),
    ])
    markets = _event_markets([
        ("KXPAYROLLS", "KXPAYROLLS-25SEP", datetime(2025, 10, 3, 12, 29, tzinfo=UTC), "119000"),
        ("KXCPI", "KXCPI-NOPERIOD", datetime(2025, 10, 15, 12, 29, tzinfo=UTC), None),
    ])
    stats = pl.DataFrame({
        "event_ticker": ["KXPAYROLLS-25SEP", "KXCPI-NOPERIOD"], "hours_before_close": [1, 1],
        "mean": [50000.0, 0.3], "sd": [40000.0, 0.1],
    })

    out = {r["event_ticker"]: r for r in event_surprises(markets, obs, stats).iter_rows(named=True)}

    jobs = out["KXPAYROLLS-25SEP"]
    assert (jobs["match_method"], jobs["release_date"], jobs["first_print"]) == (
        "reference_period", d(2025, 11, 20), 119000.0
    )
    cpi = out["KXCPI-NOPERIOD"]
    assert (cpi["match_method"], cpi["release_date"], cpi["reference_period"]) == (
        "release_window", d(2025, 10, 24), d(2025, 9, 1)
    )


def _yields(rows: list[tuple[str, date, float | None]]) -> pl.DataFrame:
    # daily closes in the current vintage, known from their own date
    return _observations([(s, d, v, d, None) for s, d, v in rows])


REACTION_EVENT_SCHEMA = {
    "event_ticker": pl.String, "first_print_source": pl.String, "first_print": pl.Float64,
    "release_date": pl.Date, "close": pl.Datetime("us", "UTC"),
}


def test_release_day_yield_changes_in_basis_points():
    d = date
    closes = _yields([
        ("DGS2", d(2026, 10, 13), 4.76), ("DGS2", d(2026, 10, 14), 4.82),
        ("DGS10", d(2026, 10, 13), 5.15), ("DGS10", d(2026, 10, 14), 5.19),
        ("DGS2", d(2026, 9, 15), 3.60), ("DGS2", d(2026, 9, 16), 3.55),
        ("DGS10", d(2026, 9, 15), 4.10), ("DGS10", d(2026, 9, 16), 4.08),
        # Friday holiday: Monday's change is measured from Thursday
        ("DGS2", d(2026, 7, 2), 3.90), ("DGS2", d(2026, 7, 3), None), ("DGS2", d(2026, 7, 6), 3.95),
        ("DGS10", d(2026, 7, 2), 4.30), ("DGS10", d(2026, 7, 3), None),
        ("DGS10", d(2026, 7, 6), 4.28),
    ])
    events = pl.DataFrame([
        ("CPI-SEP", "alfred", 0.6, d(2026, 10, 14), datetime(2026, 10, 14, 12, 29, tzinfo=UTC)),
        ("FED-SEP", "kalshi", 4.0, None, datetime(2026, 9, 16, 17, 55, tzinfo=UTC)),
        # closed two days early: the statement date, not the close date, is the reaction day
        ("FED-JUL", "kalshi", 4.0, d(2026, 7, 6), datetime(2026, 7, 2, 23, 0, tzinfo=UTC)),
        ("JOBS-JUN", "alfred", 1e5, d(2026, 7, 6), datetime(2026, 7, 6, 12, 29, tzinfo=UTC)),
        ("CPI-OCT", "alfred", None, None, datetime(2026, 11, 13, 13, 29, tzinfo=UTC)),
        # never printed, but ALFRED lists the empty month on the next release's date
        ("CPI-OCT25", "alfred", None, d(2026, 10, 14), datetime(2025, 11, 13, 13, 29, tzinfo=UTC)),
    ], schema=REACTION_EVENT_SCHEMA, orient="row")

    out = {r["event_ticker"]: r for r in release_reactions(events, closes).iter_rows(named=True)}

    cpi = out["CPI-SEP"]
    assert (cpi["reaction_date"], cpi["reaction_prev_date"]) == (d(2026, 10, 14), d(2026, 10, 13))
    assert cpi["dgs2_change_bp"] == pytest.approx(6.0)
    assert cpi["dgs10_change_bp"] == pytest.approx(4.0)
    fed = out["FED-SEP"]  # the decision day is the close's New York date
    assert fed["reaction_date"] == d(2026, 9, 16)
    assert fed["dgs2_change_bp"] == pytest.approx(-5.0)
    assert fed["dgs10_change_bp"] == pytest.approx(-2.0)
    assert out["FED-JUL"]["reaction_date"] == d(2026, 7, 6)
    jobs = out["JOBS-JUN"]
    assert jobs["reaction_prev_date"] == d(2026, 7, 2)
    assert jobs["dgs2_change_bp"] == pytest.approx(5.0)
    assert jobs["dgs10_change_bp"] == pytest.approx(-2.0)
    assert "CPI-OCT" not in out
    assert "CPI-OCT25" not in out  # another release's reaction is not borrowed


def test_release_on_a_market_holiday_has_no_change():
    d = date
    closes = _yields([
        ("DGS2", d(2026, 7, 2), 3.90), ("DGS2", d(2026, 7, 3), None),
        ("DGS10", d(2026, 7, 2), 4.30), ("DGS10", d(2026, 7, 3), None),
    ])
    events = pl.DataFrame(
        [("JOBS-JUN", "alfred", 1e5, d(2026, 7, 3), datetime(2026, 7, 3, 12, 29, tzinfo=UTC))],
        schema=REACTION_EVENT_SCHEMA, orient="row",
    )
    row = release_reactions(events, closes).row(0, named=True)
    assert row["dgs2_change_bp"] is None and row["dgs10_change_bp"] is None


def _french(rows: list[tuple[str, str, date, float | None]]) -> pl.DataFrame:
    # (file, portfolio, date, ret_pct) as in silver french_daily
    return pl.DataFrame(rows, schema={
        "file": pl.String, "portfolio": pl.String, "date": pl.Date, "ret_pct": pl.Float64,
    }, orient="row")


def test_release_day_industry_and_market_returns():
    d = date
    french = _french([
        ("industries_12", "BusEq", d(2026, 9, 11), 1.25),
        ("industries_12", "Money", d(2026, 9, 11), -0.40),
        ("industries_12", "BusEq", d(2026, 9, 10), 9.99),  # another day
        ("factors", "Mkt-RF", d(2026, 9, 11), 0.70), ("factors", "RF", d(2026, 9, 11), 0.02),
        ("factors", "SMB", d(2026, 9, 11), 0.10),
    ])
    events = pl.DataFrame([
        ("CPI-AUG", "alfred", 0.4, d(2026, 9, 11), datetime(2026, 9, 11, 12, 25, tzinfo=UTC)),
        # the library ends in September, so an October release has no rows yet
        ("CPI-SEP", "alfred", 0.6, d(2026, 10, 14), datetime(2026, 10, 14, 12, 29, tzinfo=UTC)),
        ("CPI-OCT25", "alfred", None, d(2026, 9, 11), datetime(2025, 11, 13, 13, 29, tzinfo=UTC)),
    ], schema=REACTION_EVENT_SCHEMA, orient="row")

    out = release_industry_returns(events, french)

    assert set(out["event_ticker"]) == {"CPI-AUG"}
    returns = dict(zip(out["portfolio"].to_list(), out["ret_pct"].to_list(), strict=True))
    assert returns == {"BusEq": 1.25, "Money": -0.40, "Market": pytest.approx(0.72)}


INSIGHT_EVENT_SCHEMA = {
    "series_ticker": pl.String, "event_ticker": pl.String, "first_print": pl.Float64,
    "surprise_sd": pl.Float64, "dgs2_change_bp": pl.Float64, "dgs10_change_bp": pl.Float64,
}


def test_event_insights_rank_calibration_and_yield_sensitivity():
    events = pl.DataFrame([
        # (series, event, first print, surprise in SD, 2y bp, 10y bp)
        ("KXCPI", "C1", 0.30, -1.0, -6.0, -3.0),
        ("KXCPI", "C2", 0.40, 0.0, 0.0, 0.0),
        ("KXCPI", "C3", 0.50, 1.0, 6.0, 3.0),
        ("KXCPI", "C4", 0.90, 2.0, 12.0, 6.0),
        ("KXCPI", "C5", None, None, None, None),  # never published
        ("KXFED", "F1", 4.0, 0.5, 1.0, 1.0),
    ], schema=INSIGHT_EVENT_SCHEMA, orient="row")
    stats = pl.DataFrame({
        "event_ticker": ["C1", "C2", "C3", "C4", "C5", "F1"],
        "hours_before_close": [1] * 6,
        "p05": [0.1, 0.1, 0.1, 0.1, 0.1, 3.5],
        "p25": [0.2, 0.3, 0.3, 0.3, 0.3, 3.9],
        "p75": [0.4, 0.5, 0.5, 0.5, 0.5, 4.1],
        "p95": [0.6, 0.6, 0.6, 0.6, 0.6, 4.5],
    })

    rows = event_insights(events, stats, min_pairs=3).iter_rows(named=True)
    out = {r["event_ticker"]: r for r in rows}

    # C1 0.30 sits inside both ranges; C4 0.90 is outside both
    assert (out["C1"]["in_50"], out["C1"]["in_90"]) == (True, True)
    assert (out["C4"]["in_50"], out["C4"]["in_90"]) == (False, False)
    assert out["C5"]["in_50"] is None
    # |surprise| 0, 1, 1, 2: C4 is larger than all three others, C2 than none
    assert out["C4"]["surprise_rank_pct"] == pytest.approx(1.0)
    assert out["C2"]["surprise_rank_pct"] == pytest.approx(0.0)
    assert out["C1"]["surprise_rank_pct"] == pytest.approx(1 / 3)
    cpi = out["C3"]
    assert (cpi["series_n"], cpi["series_hit_50"], cpi["series_hit_90"]) == (4, 0.75, 0.75)
    assert cpi["dgs2_bp_per_sd"] == pytest.approx(6.0)
    assert cpi["dgs10_bp_per_sd"] == pytest.approx(3.0)
    assert cpi["dgs2_corr"] == pytest.approx(1.0)
    assert cpi["yield_n"] == 4
    # one FOMC event is too few pairs for a slope
    assert out["F1"]["dgs2_bp_per_sd"] is None
    assert out["F1"]["surprise_rank_pct"] is None


def test_crps_of_one_uniform_interval_matches_the_closed_form():
    # uniform on [0, 1]: CRPS at the centre is 1/12; at 2 it is 1/3 plus the gap of 1
    assert crps_piecewise([(0.0, 1.0)], [1.0], 0.5) == pytest.approx(1 / 12)
    assert crps_piecewise([(0.0, 1.0)], [1.0], 2.0) == pytest.approx(1 / 3 + 1)
    assert crps_piecewise([(0.0, 1.0)], [1.0], -1.0) == pytest.approx(1 + 1 / 3)


def test_crps_of_two_bins_matches_numeric_integration():
    intervals, probs, y = [(0.0, 1.0), (1.0, 3.0)], [0.25, 0.75], 1.6

    def cdf(x):
        if x <= 0:
            return 0.0
        if x <= 1:
            return 0.25 * x
        if x <= 3:
            return 0.25 + 0.75 * (x - 1) / 2
        return 1.0

    step = 1e-4
    grid = [-1 + i * step for i in range(int(5 / step))]
    numeric = sum(
        (cdf(x + step / 2) - (1.0 if x + step / 2 >= y else 0.0)) ** 2 * step for x in grid
    )
    assert crps_piecewise(intervals, probs, y) == pytest.approx(numeric, abs=1e-4)


def test_pit_is_the_cumulative_probability_at_the_print():
    assert pit_value([(0.0, 1.0)], [1.0], 0.25) == pytest.approx(0.25)
    assert pit_value([(0.0, 1.0), (1.0, 3.0)], [0.25, 0.75], 2.0) == pytest.approx(0.625)
    assert pit_value([(0.0, 1.0)], [1.0], 5.0) == 1.0


def test_brier_averages_the_squared_misses_over_strikes():
    # P(X > 0.2) = 0.9 came true, P(X > 0.4) = 0.3 did not
    assert brier_score([(0.2, 0.9), (0.4, 0.3)], 0.3) == pytest.approx((0.1**2 + 0.3**2) / 2)
    assert brier_score([], 0.3) is None


def test_forecast_scores_per_event_with_a_naive_benchmark():
    close = datetime(2026, 10, 14, 12, 29, tzinfo=UTC)
    events = pl.DataFrame([
        ("KXCPI", "C1", close - timedelta(days=60), 0.2, 0.1),
        ("KXCPI", "C2", close - timedelta(days=30), 0.4, 0.1),
        ("KXCPI", "C3", close, 0.3, 0.1),
        ("KXCPI", "C4", close + timedelta(days=30), None, 0.1),  # not out yet
    ], schema={"series_ticker": pl.String, "event_ticker": pl.String,
               "close": pl.Datetime("us", "UTC"), "first_print": pl.Float64,
               "resolution": pl.Float64}, orient="row").drop("resolution")
    one_bin = [(None, 0.2, 0.1), (0.2, 0.3, 0.6), (0.3, None, 0.3)]
    bins = pl.DataFrame([
        (e, 1, lo, hi, p) for e in ("C1", "C2", "C3", "C4") for lo, hi, p in one_bin
    ], schema={"event_ticker": pl.String, "hours_before_close": pl.Int64,
               "bin_lower": pl.Float64, "bin_upper": pl.Float64, "prob": pl.Float64}, orient="row")
    survival = pl.DataFrame([
        (e, 1, k, fit) for e in ("C1", "C2", "C3", "C4") for k, fit in ((0.2, 0.9), (0.3, 0.3))
    ], schema={"event_ticker": pl.String, "hours_before_close": pl.Int64,
               "floor_strike": pl.Float64, "survival": pl.Float64}, orient="row")
    stats = pl.DataFrame({
        "event_ticker": ["C1", "C2", "C3", "C4"], "hours_before_close": [1] * 4,
        "p50": [0.28, 0.28, 0.28, 0.28],
    })

    rows = forecast_scores(events, bins, survival, stats).iter_rows(named=True)
    out = {r["event_ticker"]: r for r in rows}

    c3 = out["C3"]
    assert c3["abs_err_market"] == pytest.approx(0.02)
    assert c3["abs_err_naive"] == pytest.approx(0.1)  # last month printed 0.4
    assert c3["brier"] == pytest.approx((0.1**2 + 0.3**2) / 2)
    assert 0 < c3["pit"] < 1 and c3["crps"] > 0
    assert out["C1"]["abs_err_naive"] is None  # no earlier print to copy
    assert "C4" not in out
