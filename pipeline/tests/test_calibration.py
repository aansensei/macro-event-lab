import numpy as np
import polars as pl
import pytest
from sklearn.linear_model import LogisticRegression

from macro_event_lab import calibration, cli, config
from macro_event_lab.calibration import (
    SERIES,
    calibration_design,
    fit_calibration,
    fit_map,
    objective,
    sigmoid,
)


@pytest.fixture
def sample():
    rng = np.random.default_rng(13)
    x = np.column_stack([np.ones(120), rng.normal(size=(120, 3))])
    y = rng.binomial(1, sigmoid(x @ np.array([0.2, 1.5, -0.7, 0.3])))
    return x, y


@pytest.fixture
def rows():
    rng = np.random.default_rng(42)
    logits = rng.normal(size=160)
    return pl.DataFrame({
        "series_ticker": [s for s in SERIES for _ in range(40)],
        "event_ticker": [f"E{i // 4}" for i in range(160)],
        "market_logit": logits,
        "outcome": rng.binomial(1, sigmoid(0.3 + 0.7 * logits)),
    })


def test_sigmoid_is_stable_at_extreme_inputs():
    assert sigmoid(np.array([-1000.0, 0, 1000.0])) == pytest.approx([0, 0.5, 1])


def test_objective_agrees_with_direct_likelihood_and_prior(sample):
    x, y = sample
    w = np.array([0.2, 0.5, -0.3, 0.1])
    prior = np.ones(4)
    precision = np.arange(1.0, 5.0)
    weights = np.linspace(0.5, 1.5, len(y))
    prob = sigmoid(x @ w)
    expected = -weights @ (y * np.log(prob) + (1 - y) * np.log1p(-prob))
    expected += 0.5 * np.sum(precision * (w - prior) ** 2)
    assert objective(w, x, y, weights, prior, precision) == pytest.approx(expected)


def test_irls_matches_independent_library_with_weighted_observations(sample):
    x, y = sample
    weights = np.linspace(0.3, 2, len(y))
    precision = np.full(x.shape[1], 2.5)
    ours = fit_map(x, y, precision=precision, weights=weights)
    reference = LogisticRegression(C=1 / 2.5, fit_intercept=False, tol=1e-12, max_iter=5000)
    reference.fit(x, y, sample_weight=weights)
    assert ours.coef == pytest.approx(reference.coef_[0], abs=1e-6)
    assert ours.predict(x) == pytest.approx(reference.predict_proba(x)[:, 1], abs=1e-7)


def test_gradient_descent_and_irls_agree_for_market_centered_prior(sample):
    x, y = sample
    prior = np.array([0.0, 1.0, 0.0, 0.0])
    precision = np.array([2.0, 1.0, 3.0, 0.5])
    irls = fit_map(x, y, prior=prior, precision=precision)
    gd = fit_map(x, y, prior=prior, precision=precision, method="gd")
    assert gd.coef == pytest.approx(irls.coef, abs=1e-7)
    assert irls.gradient_norm < 1e-8


def test_prior_identifies_collinear_and_separated_designs():
    x = np.array([[1, -2, -2], [1, -1, -1], [1, 1, 1], [1, 2, 2]], dtype=float)
    fit = fit_map(x, np.array([0, 0, 1, 1]))
    assert np.isfinite(fit.coef).all()
    assert fit.singular_values[-1] < 1e-12
    assert fit.coef[1] == pytest.approx(fit.coef[2])


@pytest.mark.parametrize("kwargs", [
    {"precision": np.zeros(4)}, {"weights": np.array([1.0])},
    {"method": "unknown"}, {"tol": 0},
])
def test_solver_rejects_invalid_inputs(sample, kwargs):
    with pytest.raises(ValueError):
        fit_map(*sample, **kwargs)


def test_solver_reports_nonconvergence(sample):
    with pytest.raises(RuntimeError, match="max_iter"):
        fit_map(*sample, method="gd", max_iter=1)


def test_design_weights_each_event_once_and_centers_prior_on_market(rows):
    x, y, weights = calibration_design(rows)
    prior = np.zeros(x.shape[1])
    prior[1] = 1
    assert x @ prior == pytest.approx(rows["market_logit"].to_numpy())
    assert y == pytest.approx(rows["outcome"].to_numpy())
    assert weights.reshape(-1, 4).sum(axis=1) == pytest.approx(np.ones(40))
    assert x.shape == (160, 10)


def test_design_rejects_empty_or_unknown_series(rows):
    with pytest.raises(ValueError):
        calibration_design(rows.head(0))
    with pytest.raises(ValueError):
        calibration_design(rows.with_columns(series_ticker=pl.lit("UNKNOWN")))


def test_calibration_is_invariant_to_duplicating_contract_rows(rows):
    table, fit = fit_calibration(rows)
    duplicate, second = fit_calibration(pl.concat([rows, rows]))
    assert table["bias"].to_numpy() == pytest.approx(duplicate["bias"].to_numpy())
    assert table["confidence"].to_numpy() == pytest.approx(duplicate["confidence"].to_numpy())
    assert fit.coef == pytest.approx(second.coef)
    assert table["n_events"].to_list() == [10, 10, 10, 10]


def test_unobserved_series_uses_the_shared_effect(rows):
    table, fit = fit_calibration(rows.filter(pl.col("series_ticker") != "KXGDP"))
    missing = table.filter(pl.col("series_ticker") == "KXGDP").row(0, named=True)
    assert missing["n_events"] == 0
    assert missing["bias"] == pytest.approx(fit.coef[0])
    assert missing["confidence"] == pytest.approx(fit.coef[1])


def test_prior_sd_changes_precision_and_shrinkage(rows):
    _, tight = fit_calibration(rows, prior_sd=0.1)
    _, loose = fit_calibration(rows, prior_sd=2.0)
    prior = np.zeros(10)
    prior[1] = 1
    assert np.linalg.norm(tight.coef - prior) < np.linalg.norm(loose.coef - prior)
    x, y, weights = calibration_design(rows)
    expected = fit_map(x, y, weights=weights, prior=prior, precision=np.full(10, 0.25))
    assert loose.coef == pytest.approx(expected.coef)


@pytest.mark.parametrize("sd", [0, -1, float("nan"), float("inf")])
def test_invalid_prior_sd_is_rejected(rows, sd):
    with pytest.raises(ValueError, match="prior_sd"):
        fit_calibration(rows, prior_sd=sd)


def test_model_command_writes_only_local_map_tables(tmp_path, monkeypatch, capsys, rows):
    paths = config.Paths(tmp_path)
    paths.gold.mkdir()
    paths.silver.mkdir()
    for path in (paths.gold / "implied_survival.parquet", paths.gold / "implied_stats.parquet",
                 paths.silver / "kalshi_markets.parquet"):
        pl.DataFrame({"placeholder": [1]}).write_parquet(path)
    monkeypatch.setattr(config, "get_paths", lambda: paths)
    monkeypatch.setattr(calibration, "calibration_rows", lambda *args: rows)
    from macro_event_lab import model_evaluation

    monkeypatch.setattr(model_evaluation, "attach_label_times", lambda frame, _: frame)
    monkeypatch.setattr(model_evaluation, "walk_forward", lambda _: pl.DataFrame())
    monkeypatch.setattr(model_evaluation, "prior_sensitivity", lambda *args: pl.DataFrame(
        {"prior_sd": [0.5, 1.0, 2.0]}
    ))
    cli.main(["model"])
    assert pl.read_parquet(paths.gold / "calibration_rows.parquet").equals(rows)
    assert pl.read_parquet(paths.gold / "calibration_map.parquet").height == 4
    assert not (paths.gold / "calibration_posterior.parquet").exists()
    assert pl.read_parquet(paths.gold / "model_scores.parquet")["prior_sd"].to_list() == [1.0]
    assert pl.read_parquet(paths.gold / "model_sensitivity.parquet").height == 3
    assert "No posterior intervals" in capsys.readouterr().out
