from datetime import UTC, datetime, timedelta

import polars as pl
import pytest

from macro_event_lab.model import CLIP, calibration_rows, logit

CLOSE = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def _survival(rows: list[tuple]) -> pl.DataFrame:
    # (ticker, strike, hours_before_close, fitted probability, weight, price_age_h)
    return pl.DataFrame(
        [
            ("KXCPI", "CPI-OCT", t, CLOSE - timedelta(hours=h), h, t, k, p, p, w, a)
            for t, k, h, p, w, a in rows
        ],
        schema={
            "series_ticker": pl.String, "event_ticker": pl.String, "ticker": pl.String,
            "ts": pl.Datetime("us", "UTC"), "hours_before_close": pl.Int64, "_t": pl.String,
            "floor_strike": pl.Float64, "price": pl.Float64, "survival": pl.Float64,
            "weight": pl.Float64, "price_age_h": pl.Int64,
        },
        orient="row",
    ).drop("_t")


def _stats(rows: list[tuple]) -> pl.DataFrame:
    # (hours_before_close, p50, sd)
    return pl.DataFrame(
        [("CPI-OCT", CLOSE - timedelta(hours=h), m, s) for h, m, s in rows],
        schema={"event_ticker": pl.String, "ts": pl.Datetime("us", "UTC"),
                "p50": pl.Float64, "sd": pl.Float64},
        orient="row",
    )


def _markets(rows: list[tuple]) -> pl.DataFrame:
    # (ticker, status, result)
    return pl.DataFrame(rows, schema={"ticker": pl.String, "status": pl.String,
                                      "result": pl.String}, orient="row")


def test_logit_clips_extreme_prices():
    assert logit(0.5) == 0.0
    assert logit(0.0) == logit(CLIP)
    assert logit(1.0) == pytest.approx(-logit(0.0))


def test_rows_keep_only_settled_contracts_at_the_training_horizons():
    survival = _survival([
        ("T0.3", 0.3, 1, 0.6, 50.0, 0),
        ("T0.3", 0.3, 2, 0.6, 50.0, 1),  # not a training horizon
        ("T0.4", 0.4, 1, 0.2, 10.0, 3),
        ("T0.5", 0.5, 1, 0.1, 10.0, 3),
    ])
    markets = _markets([
        ("T0.3", "finalized", "yes"), ("T0.4", "finalized", "no"), ("T0.5", "active", None),
    ])

    rows = calibration_rows(survival, _stats([]), markets)

    assert rows["ticker"].to_list() == ["T0.3", "T0.4"]
    assert rows["outcome"].to_list() == [1, 0]
    assert rows["spread"].to_list() == pytest.approx([0.02, 0.1])
    assert rows["event_close"].to_list() == [CLOSE, CLOSE]


def test_features_use_only_snapshots_at_or_before_the_row():
    survival = _survival([
        ("T0.3", 0.3, 25, 0.40, 50.0, 0),  # 24 hours before the T-1h row
        ("T0.3", 0.3, 1, 0.60, 50.0, 0),
        ("T0.3", 0.3, 0, 0.99, 50.0, 0),  # the close itself, after the T-1h row
    ])
    markets = _markets([("T0.3", "finalized", "yes")])
    stats = _stats([(1, 0.25, 0.1), (0, 0.9, 0.1)])

    (row,) = calibration_rows(survival, stats, markets, horizons=(1,)).iter_rows(named=True)

    assert row["change_24h"] == pytest.approx(logit(0.60) - logit(0.40))
    assert row["strike_z"] == pytest.approx((0.3 - 0.25) / 0.1)  # the T-1h median, not the close's
    assert row["has_distribution"] is True
    assert row["market_prob"] == 0.60


def test_missing_history_and_distribution_fall_back_to_neutral_values():
    survival = _survival([("T0.3", 0.3, 168, 0.5, 10.0, 7)])  # first listed a week out
    markets = _markets([("T0.3", "finalized", "no")])
    stats = _stats([(168, None, None)])  # a single contract: no distribution

    (row,) = calibration_rows(survival, stats, markets).iter_rows(named=True)

    assert row["change_24h"] == 0.0
    assert row["strike_z"] == 0.0
    assert row["has_distribution"] is False


def test_training_rows_keep_raw_and_isotonic_probabilities_separate():
    survival = _survival([("T0.3", 0.3, 1, 0.6, 50.0, 0)]).with_columns(price=pl.lit(0.7))
    rows = calibration_rows(survival, _stats([]), _markets([("T0.3", "finalized", "yes")]))
    assert rows["raw_prob"].to_list() == [0.7]
    assert rows["market_prob"].to_list() == [0.6]
