from datetime import UTC, datetime, timedelta

import numpy as np
import polars as pl
import pytest

from macro_event_lab.model_evaluation import attach_label_times, score_predictions, walk_forward


@pytest.fixture
def rows():
    start = datetime(2020, 1, 1, tzinfo=UTC)
    records = []
    for i in range(25):
        close = start + timedelta(days=30 * i)
        for h in (1, 24, 168):
            for k, p in enumerate((0.2, 0.8)):
                records.append({
                    "series_ticker": "KXCPI", "event_ticker": f"E{i:02}",
                    "ticker": f"E{i:02}T{k}", "ts": close - timedelta(hours=h),
                    "hours_before_close": h, "market_logit": np.log(p / (1 - p)),
                    "raw_prob": p, "outcome": int((i + k) % 3 == 0),
                    "label_known_from": close + timedelta(days=2),
                })
    return pl.DataFrame(records)


def test_label_clock_uses_settlement_or_observed_fetch_upper_bound():
    t = datetime(2020, 1, 1, tzinfo=UTC)
    markets = pl.DataFrame({"ticker": ["A", "B"], "settlement_ts": [t, None],
                           "fetched_at_utc": [(t + timedelta(days=7)).isoformat()] * 2})
    result = attach_label_times(pl.DataFrame({"ticker": ["A", "B", "C"]}), markets)
    assert result["label_known_from"].to_list() == [t, t + timedelta(days=7), None]
    assert result["label_time_source"].to_list() == ["settlement_ts", "fetched_at_utc", None]


def test_walk_forward_holds_out_all_horizons_and_checks_label_clock(rows):
    result = walk_forward(rows, min_events=5)
    assert result["event_ticker"].n_unique() == 20
    assert (result["train_labels_through"] < result["fit_cutoff"]).all()
    assert (result["fit_cutoff"] <= result["ts"]).all()
    assert result.group_by("event_ticker").agg(pl.col("n_train_events").n_unique())[
        "n_train_events"
    ].to_list() == [1] * 20
    assert result.group_by("event_ticker").len()["len"].to_list() == [6] * 20


def test_future_labels_and_features_do_not_change_earlier_predictions(rows):
    baseline = walk_forward(rows, min_events=5)
    shocked = rows.with_columns(
        outcome=pl.when(pl.col("event_ticker") == "E24").then(1 - pl.col("outcome"))
        .otherwise(pl.col("outcome")),
        market_logit=pl.when(pl.col("event_ticker") == "E24").then(20.0)
        .otherwise(pl.col("market_logit")),
    )
    changed = walk_forward(shocked, min_events=5)
    earlier = pl.col("event_ticker") != "E24"
    assert baseline.filter(earlier)["calibrated_prob"].to_numpy() == pytest.approx(
        changed.filter(earlier)["calibrated_prob"].to_numpy()
    )


def test_event_with_one_missing_or_delayed_label_cannot_train(rows):
    changed = rows.with_columns(label_known_from=pl.when(pl.col("ticker") == "E00T0")
                               .then(None).otherwise(pl.col("label_known_from")))
    result = walk_forward(changed, min_events=5)
    assert result["event_ticker"].n_unique() == 19
    delayed = rows.with_columns(label_known_from=pl.when(pl.col("ticker") == "E00T0")
                               .then(datetime(2030, 1, 1, tzinfo=UTC))
                               .otherwise(pl.col("label_known_from")))
    assert walk_forward(delayed, min_events=5)["n_train_events"].to_list() == (
        result["n_train_events"].to_list()
    )


def test_empty_evaluation_has_stable_schema(rows):
    predictions = walk_forward(rows, min_events=100)
    assert predictions.height == 0
    assert "calibrated_prob" in predictions.columns
    assert score_predictions(predictions).height == 0


def test_test_event_labels_do_not_reach_any_of_its_predictions(rows):
    first = walk_forward(rows, min_events=5).filter(pl.col("event_ticker") == "E10")
    changed = rows.with_columns(outcome=pl.when(pl.col("event_ticker") == "E10")
                               .then(1 - pl.col("outcome")).otherwise(pl.col("outcome")))
    second = walk_forward(changed, min_events=5).filter(pl.col("event_ticker") == "E10")
    assert first["calibrated_prob"].to_numpy() == pytest.approx(
        second["calibrated_prob"].to_numpy()
    )


def test_label_at_exact_forecast_cutoff_is_excluded(rows):
    cutoff = rows.filter(pl.col("event_ticker") == "E05")["ts"].min()
    changed = rows.with_columns(label_known_from=pl.when(pl.col("event_ticker") == "E00")
                               .then(cutoff).otherwise(pl.col("label_known_from")))
    result = walk_forward(changed, min_events=5)
    assert "E05" not in result["event_ticker"].to_list()


def test_scores_use_raw_prices_and_average_contracts_within_events():
    predictions = pl.DataFrame({
        "series_ticker": ["KXCPI"] * 4, "hours_before_close": [1] * 4,
        "event_ticker": ["A", "B", "B", "B"], "outcome": [1] * 4,
        "raw_prob": [0.0, 1.0, 1.0, 1.0], "calibrated_prob": [0.5] * 4,
    })
    result = score_predictions(predictions, draws=100)
    brier = result.filter(pl.col("metric") == "brier").row(0, named=True)
    assert brier["n_events"] == 2
    assert brier["market_score"] == 0.5
    assert brier["model_score"] == 0.25
    assert brier["delta"] == -0.25
    assert result["market_score"].is_finite().all()
    assert result.equals(score_predictions(predictions, draws=100))


def test_paired_bootstrap_has_zero_width_when_predictions_equal_market(rows):
    predictions = rows.with_columns(calibrated_prob=pl.col("raw_prob"))
    scores = score_predictions(predictions, draws=100)
    assert scores["delta"].to_list() == [0.0] * 6
    assert scores["lo"].to_list() == [0.0] * 6
    assert scores["hi"].to_list() == [0.0] * 6
