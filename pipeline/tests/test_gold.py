from datetime import UTC, datetime, timedelta

import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.config import Paths
from macro_event_lab.gold import (
    bin_intervals,
    bins_from_survival,
    build_gold,
    contract_prices,
    distribution_stats,
    implied_distributions,
    implied_stats,
    isotonic_decreasing,
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
}
PRICE_SCHEMA = {
    "ticker": pl.String, "end_period_ts": pl.Datetime("us", "UTC"), "price": pl.Float64,
    "weight": pl.Float64,
}


def _markets(strikes: dict[str, float]) -> pl.DataFrame:
    rows = [("KXCPI", "E", t, "greater", k, CLOSE) for t, k in strikes.items()]
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

    counts = build_gold(paths)

    assert counts["contract_prices"] == 2
    out = pl.read_parquet(paths.gold / "contract_prices.parquet")
    assert out["price_source"].to_list() == ["mid", None]
    assert (paths.gold / "implied_bins.parquet").exists()


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
