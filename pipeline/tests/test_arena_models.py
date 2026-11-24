from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pytest

from macro_event_lab.arena import contestants, linalg, selection


def random_panel(n: int = 60, p: int = 5, seed: int = 3):
    rng = np.random.default_rng(seed)
    return rng.normal(size=(n, p)), rng


def test_standardize_uses_training_statistics_only() -> None:
    train = np.array([[1.0, 10.0], [3.0, 10.0]])
    other = np.array([[5.0, 10.0]])
    z_train, z_other, mean, scale = linalg.standardize(train, other)
    assert mean.tolist() == [2.0, 10.0]
    assert scale.tolist() == [1.0, 1.0]
    assert z_train[:, 0].tolist() == [-1.0, 1.0]
    assert z_other[0].tolist() == [3.0, 0.0]


def test_pca_reconstructs_the_data_and_produces_uncorrelated_scores() -> None:
    x, _ = random_panel()
    z, _mean, _scale = linalg.standardize(x)
    components = linalg.pca_components(z, z.shape[1])
    scores = linalg.pca_scores(z, components)
    assert np.allclose(scores @ components, z, atol=1e-10)
    covariance = scores.T @ scores / len(z)
    assert np.allclose(covariance - np.diag(np.diag(covariance)), 0.0, atol=1e-10)
    total_variance = float((z * z).sum() / len(z))
    assert float(np.trace(covariance)) == pytest.approx(total_variance)


def test_pca_direction_sign_is_fixed_by_the_largest_loading() -> None:
    x, _ = random_panel(seed=11)
    z, _mean, _scale = linalg.standardize(x)
    for row in linalg.pca_components(z, 3):
        assert row[np.argmax(np.abs(row))] > 0


def test_soft_threshold_shrinks_towards_zero() -> None:
    assert linalg.soft_threshold(3.0, 1.0) == 2.0
    assert linalg.soft_threshold(-3.0, 1.0) == -2.0
    assert linalg.soft_threshold(0.5, 1.0) == 0.0


def test_lasso_with_an_orthonormal_design_equals_soft_thresholding() -> None:
    rng = np.random.default_rng(5)
    n, p = 80, 4
    raw = rng.normal(size=(n, p + 1))
    raw -= raw.mean(axis=0)
    q, _ = np.linalg.qr(raw)
    z = np.sqrt(n) * q[:, :p]
    assert np.allclose(z.T @ z / n, np.eye(p), atol=1e-10)
    y = z @ np.array([1.5, -0.2, 0.0, 0.8]) + 0.3 * rng.normal(size=n) + 4.0
    lam = 0.25
    intercept, coefficients = linalg.lasso_fit(z, y, lam)
    ols = z.T @ (y - y.mean()) / n
    assert np.allclose(coefficients, linalg.soft_threshold(ols, lam), atol=1e-7)
    assert intercept == pytest.approx(float(y.mean()))


def test_lasso_solution_satisfies_the_optimality_conditions() -> None:
    x, rng = random_panel(n=70, p=6, seed=2)
    z, _mean, _scale = linalg.standardize(x)
    y = z @ np.array([2.0, 0.0, -1.0, 0.0, 0.5, 0.0]) + rng.normal(size=len(z))
    lam = 0.1
    _intercept, coefficients = linalg.lasso_fit(z, y, lam)
    gradient = z.T @ (y - y.mean() - z @ coefficients) / len(y)
    for j, value in enumerate(coefficients):
        if value != 0.0:
            assert gradient[j] == pytest.approx(lam * np.sign(value), abs=1e-6)
        else:
            assert abs(gradient[j]) <= lam + 1e-6


def test_lasso_penalty_extremes() -> None:
    x, rng = random_panel(n=70, p=4, seed=8)
    z, _mean, _scale = linalg.standardize(x)
    y = z @ np.array([1.0, -2.0, 0.5, 0.0]) + 0.1 * rng.normal(size=len(z))
    top = linalg.lasso_lambda_max(z, y)
    _b0, at_top = linalg.lasso_fit(z, y, top)
    assert np.allclose(at_top, 0.0)
    _b0, below = linalg.lasso_fit(z, y, top * 0.9)
    assert np.any(below != 0.0)
    _b0, tiny = linalg.lasso_fit(z, y, 1e-9)
    least_squares, *_ = np.linalg.lstsq(z, y - y.mean(), rcond=None)
    assert np.allclose(tiny, least_squares, atol=1e-4)
    grid = linalg.lasso_grid(z, y)
    assert len(grid) == linalg.LASSO_GRID_SIZE
    assert grid[0] == pytest.approx(top)
    assert grid[-1] == pytest.approx(top * linalg.LASSO_GRID_RATIO)


def test_inner_splits_train_only_on_rows_public_at_each_forecast_date() -> None:
    start = date(2010, 1, 1)
    release = [start + timedelta(days=90 * i) for i in range(20)]
    as_of = [r - timedelta(days=60) for r in release]
    for train, i in selection.inner_splits(20, release, as_of):
        assert all(release[j] <= as_of[i] for j in train)
        assert i not in train


def make_training(n: int = 40):
    x, rng = random_panel(n=n, p=4, seed=1)
    y = x @ np.array([1.0, -0.5, 0.0, 0.3]) + 0.2 * rng.normal(size=n)
    release = [date(2005, 1, 1) + timedelta(days=90 * i) for i in range(n)]
    made_on = [r - timedelta(days=60) for r in release]
    return x, y, release, made_on


@pytest.mark.parametrize("forecast", [
    contestants.ridge_forecast, contestants.factor_ridge_forecast, contestants.lasso_forecast,
])
def test_models_need_enough_released_answers(forecast) -> None:
    x, y, release, made_on = make_training()
    assert forecast(x, y.tolist(), release, made_on, x[0], release[10]) is None
    assert forecast(x, y.tolist(), release, made_on, x[39], made_on[39]) is not None


@pytest.mark.parametrize("forecast", [
    contestants.ridge_forecast, contestants.factor_ridge_forecast, contestants.lasso_forecast,
])
def test_models_ignore_answers_published_after_the_forecast_date(forecast) -> None:
    x, y, release, made_on = make_training()
    origin = made_on[35]
    baseline = forecast(x, y.tolist(), release, made_on, x[35], origin)
    changed = y.copy()
    later = [i for i, r in enumerate(release) if r > origin]
    changed[later] += 100.0
    assert later
    assert forecast(x, changed.tolist(), release, made_on, x[35], origin) == baseline


def test_models_fill_a_missing_indicator_with_the_training_mean() -> None:
    x, y, release, made_on = make_training()
    row = x[39].copy()
    row[2] = np.nan
    value = contestants.lasso_forecast(x, y.tolist(), release, made_on, row, made_on[39])
    assert value is not None
    assert np.isfinite(value)
