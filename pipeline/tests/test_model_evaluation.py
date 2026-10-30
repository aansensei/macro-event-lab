from datetime import UTC, datetime, timedelta

import numpy as np
import polars as pl
import pytest

from macro_event_lab.model_evaluation import (
    COMPARISON_FAMILY,
    attach_label_times,
    prior_sensitivity,
    score_predictions,
    walk_forward,
)


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
                    "raw_prob": p, "market_prob": p, "outcome": int((i + k) % 3 == 0),
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
        "market_prob": [0.5, 1.0, 1.0, 1.0],
    })
    result = score_predictions(predictions, draws=100)
    brier = result.filter((pl.col("metric") == "brier") & (pl.col("baseline") == "raw")
                          & (pl.col("candidate") == "map")).row(0, named=True)
    assert brier["n_events"] == 2
    assert brier["baseline_score"] == 0.5
    assert brier["candidate_score"] == 0.25
    assert brier["delta"] == -0.25
    assert result["baseline_score"].is_finite().all()
    isotonic = result.filter((pl.col("metric") == "brier") & (pl.col("baseline") == "raw")
                            & (pl.col("candidate") == "isotonic")).row(0, named=True)
    incremental = result.filter((pl.col("metric") == "brier")
                                & (pl.col("baseline") == "isotonic")).row(0, named=True)
    assert isotonic["delta"] == -0.375
    assert incremental["delta"] == 0.125
    assert brier["delta"] == isotonic["delta"] + incremental["delta"]
    assert result["n_events"].to_list() == [2] * 6
    assert result.equals(score_predictions(predictions, draws=100))


def test_paired_bootstrap_has_zero_width_when_predictions_equal_market(rows):
    predictions = rows.with_columns(calibrated_prob=pl.col("raw_prob"))
    scores = score_predictions(predictions, draws=100)
    assert scores["delta"].to_list() == [0.0] * 18
    assert scores["lo"].to_list() == [0.0] * 18
    assert scores["hi"].to_list() == [0.0] * 18


def test_isotonic_improvement_is_not_attributed_to_map(rows):
    predictions = rows.with_columns(market_prob=pl.lit(0.5), calibrated_prob=pl.lit(0.5))
    scores = score_predictions(predictions, draws=100)
    incremental = scores.filter(pl.col("baseline") == "isotonic")
    assert incremental["delta"].to_list() == [0.0] * 6
    assert incremental["lo"].to_list() == [0.0] * 6
    assert incremental["hi"].to_list() == [0.0] * 6
    assert scores.filter(pl.col("baseline") == "raw")["delta"].abs().sum() > 0


def test_score_deltas_decompose_for_both_metrics_and_all_horizons(rows):
    predictions = rows.with_columns(market_prob=pl.lit(0.4), calibrated_prob=pl.lit(0.5))
    scores = score_predictions(predictions, draws=100)
    for _, group in scores.group_by("series_ticker", "hours_before_close", "metric"):
        deltas = {(r["baseline"], r["candidate"]): r["delta"]
                  for r in group.iter_rows(named=True)}
        assert deltas["raw", "map"] == pytest.approx(
            deltas["raw", "isotonic"] + deltas["isotonic", "map"]
        )
        assert group["n_events"].n_unique() == 1


def test_bootstrap_reproducibility_includes_multiple_series_and_horizons(rows):
    predictions = pl.concat([
        rows, rows.with_columns(series_ticker=pl.lit("KXGDP"),
                                event_ticker=pl.col("event_ticker") + "GDP"),
    ]).with_columns(calibrated_prob=pl.lit(0.5))
    first = score_predictions(predictions, draws=100)
    second = score_predictions(predictions.reverse(), draws=100)
    assert first.equals(second)


@pytest.mark.parametrize("value", [None, float("nan"), float("inf"), -0.1, 1.1])
def test_invalid_probability_cannot_change_the_paired_sample_silently(rows, value):
    predictions = rows.with_columns(calibrated_prob=pl.lit(0.5), market_prob=pl.lit(value))
    with pytest.raises(ValueError, match="scoring"):
        score_predictions(predictions)


def test_bonferroni_intervals_use_adjusted_quantiles_on_the_same_draws(rows):
    predictions = rows.with_columns(calibrated_prob=pl.lit(0.5))
    scores = score_predictions(predictions, draws=1000, family_size=COMPARISON_FAMILY)
    assert (scores["family_lo"] <= scores["lo"]).all()
    assert (scores["family_hi"] >= scores["hi"]).all()
    assert scores["family_size"].to_list() == [216] * scores.height
    group = scores.filter((pl.col("hours_before_close") == 1)
                          & (pl.col("metric") == "brier")
                          & (pl.col("baseline") == "raw") & (pl.col("candidate") == "map"))
    source = predictions.filter(pl.col("hours_before_close") == 1).with_columns(
        delta=(pl.col("calibrated_prob") - pl.col("outcome")) ** 2
        - (pl.col("raw_prob") - pl.col("outcome")) ** 2,
    ).group_by("event_ticker").agg(pl.col("delta").mean()).sort("event_ticker")
    delta = source["delta"].to_numpy()
    rng = np.random.default_rng(0)
    boot = delta[rng.integers(len(delta), size=(1000, len(delta)))].mean(axis=1)
    expected = np.quantile(boot, [0.05 / (2 * 216), 1 - 0.05 / (2 * 216)])
    assert [group["family_lo"][0], group["family_hi"][0]] == pytest.approx(expected)


def test_unadjusted_family_matches_pointwise_intervals(rows):
    scores = score_predictions(rows.with_columns(calibrated_prob=pl.lit(0.5)), draws=100)
    assert scores["family_lo"].to_list() == scores["lo"].to_list()
    assert scores["family_hi"].to_list() == scores["hi"].to_list()


def test_prior_sensitivity_preserves_splits_reports_all_scales_and_is_reproducible(rows):
    scores = prior_sensitivity(rows, min_events=5, draws=100)
    assert sorted(scores["prior_sd"].unique().to_list()) == [0.5, 1, 2]
    assert scores.group_by("prior_sd").len()["len"].to_list() == [18] * 3
    assert scores["n_events"].to_list() == [20] * scores.height
    raw_scores = scores.filter((pl.col("baseline") == "raw") & (pl.col("candidate") == "map"))
    assert raw_scores.group_by("hours_before_close", "metric").agg(
        pl.col("baseline_score").n_unique()
    )["baseline_score"].to_list() == [1] * 6
    reference = walk_forward(rows, min_events=5)
    assert scores.equals(prior_sensitivity(rows, reference, min_events=5, draws=100))


def test_prior_sensitivity_keeps_future_information_out_at_every_scale(rows):
    changed = rows.with_columns(outcome=pl.when(pl.col("event_ticker") == "E24")
                               .then(1 - pl.col("outcome")).otherwise(pl.col("outcome")))
    for sd in (0.5, 1, 2):
        first = walk_forward(rows, min_events=5, prior_sd=sd)
        second = walk_forward(changed, min_events=5, prior_sd=sd)
        assert first["calibrated_prob"].to_numpy() == pytest.approx(
            second["calibrated_prob"].to_numpy()
        )
