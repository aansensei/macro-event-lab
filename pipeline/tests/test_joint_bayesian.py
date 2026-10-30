from datetime import UTC, datetime

import numpy as np
import polars as pl
import pytest

pytest.importorskip("pymc")
from test_bayesian import trace as trace

from macro_event_lab import cli, config, joint_bayesian
from macro_event_lab.joint_bayesian import (
    SUPPORT_MIX,
    build_joint_model,
    category_probabilities,
    event_categories,
    joint_checks,
)


@pytest.fixture
def rows():
    t = datetime(2025, 1, 1, tzinfo=UTC)
    return pl.DataFrame({
        "series_ticker": ["KXCPI"] * 3 + ["KXGDP"],
        "event_ticker": ["CPI"] * 3 + ["GDP"], "hours_before_close": [1] * 4,
        "ts": [t] * 4, "floor_strike": [0.1, 0.2, 0.3, 1.0],
        "market_prob": [0.8, 0.5, 0.2, 0.4], "outcome": [1, 1, 0, 0],
    })


def test_categories_recover_the_single_event_outcome_and_ignore_other_horizons(rows):
    other = rows.with_columns(hours_before_close=pl.lit(24, dtype=pl.Int64),
                              outcome=1 - pl.col("outcome"))
    events = event_categories(pl.concat([rows, other]))
    assert [e["category"] for e in events] == [2, 0]
    assert len(events) == 2
    assert np.array_equal(events[0]["strikes"], [0.1, 0.2, 0.3])


@pytest.mark.parametrize("change", [
    {"outcome": [0, 1, 0, 0]}, {"floor_strike": [0.1, 0.1, 0.3, 1.0]},
    {"market_prob": [0.5, 0.8, 0.2, 0.4]}, {"market_prob": [float("nan"), 0.5, 0.2, 0.4]},
])
def test_inconsistent_event_inputs_fail_instead_of_becoming_independent_labels(rows, change):
    with pytest.raises(ValueError):
        event_categories(rows.with_columns(*[pl.Series(k, v) for k, v in change.items()]))


def test_probabilities_are_normalized_supported_and_keep_exact_tails():
    logits = np.log(np.array([0.8, 0.5, 0.2]) / np.array([0.2, 0.5, 0.8]))
    p = category_probabilities(logits, np.array(0), np.array(1))
    assert p == pytest.approx((1 - SUPPORT_MIX) * np.array([0.2, 0.3, 0.3, 0.2])
                              + SUPPORT_MIX / 4)
    flat = category_probabilities(np.array([0.0, 0.0]), np.array(0), np.array(2))
    assert flat[1] == pytest.approx(SUPPORT_MIX / 3)
    assert flat.sum() == pytest.approx(1)
    with pytest.raises(ValueError, match="positive"):
        category_probabilities(logits, np.array(0), np.array(-1))


def test_categorical_log_likelihood_counts_each_event_once_with_ragged_bins(rows):
    events = event_categories(rows)
    model = build_joint_model(events)
    observed_logp = model.compile_logp(vars=model.observed_RVs)(model.initial_point())
    expected = sum(np.log(category_probabilities(e["logits"], np.array(0), np.array(1))[
        e["category"]
    ]) for e in events)
    assert observed_logp == pytest.approx(expected)
    assert len(model.observed_RVs) == 1


def test_replicated_categories_imply_monotone_labels_and_shared_event_outcome(trace, rows):
    trace.posterior["confidence"].values[:] = np.abs(trace.posterior["confidence"].values) + 0.1
    events = event_categories(rows)
    checks, draws = joint_checks(trace, events)
    assert checks.height == 2
    assert draws.height == 8000
    for event in events:
        category = draws.filter(pl.col("event_ticker") == event["event_ticker"])["category"]
        category = category.to_numpy()
        labels = category[:, None] > np.arange(len(event["strikes"]))[None, :]
        assert (np.diff(labels.astype(int), axis=1) <= 0).all()
        assert (labels.sum(axis=1) == category).all()
    again, again_draws = joint_checks(trace, events)
    assert checks.equals(again) and draws.equals(again_draws)


def test_joint_command_preserves_generalized_outputs_and_gates_diagnostics(
    tmp_path, monkeypatch, capsys, trace, rows,
):
    trace.posterior["confidence"].values[:] = np.abs(trace.posterior["confidence"].values) + 0.1
    paths = config.Paths(tmp_path)
    paths.gold.mkdir()
    rows.write_parquet(paths.gold / "calibration_rows.parquet")
    monkeypatch.setattr(config, "get_paths", lambda: paths)
    monkeypatch.setattr(joint_bayesian, "sample_model", lambda *args, **kwargs: trace)
    cli.main(["model", "--joint"])
    assert "Joint categorical posterior" in capsys.readouterr().out
    assert not (paths.gold / "calibration_posterior.parquet").exists()
    assert (paths.gold / "joint_calibration_draws.npz").exists()
    trace.sample_stats["diverging"].values[0, 0] = True
    with pytest.raises(RuntimeError, match="diagnostics failed"):
        joint_bayesian.build_joint_posterior(paths)
    assert not pl.read_parquet(paths.gold / "joint_calibration_posterior.parquet")[
        "diagnostics_passed"
    ].any()
