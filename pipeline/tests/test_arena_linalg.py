"""Tests for linear algebra, PCA, and LASSO coordinate descent."""

from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.arena import linalg


def test_pca_exact_reconstruction() -> None:
    rng = np.random.default_rng(42)
    x = rng.normal(size=(50, 6))
    z, _mean, _scale = linalg.standardize(x)
    components = linalg.pca_components(z, 6)
    scores = linalg.pca_scores(z, components)
    reconstructed = scores @ components
    assert np.allclose(reconstructed, z, atol=1e-10)


def test_pca_scores_are_uncorrelated() -> None:
    rng = np.random.default_rng(123)
    x = rng.normal(size=(60, 5))
    z, _mean, _scale = linalg.standardize(x)
    components = linalg.pca_components(z, 5)
    scores = linalg.pca_scores(z, components)
    cov = (scores.T @ scores) / len(scores)
    off_diagonal = cov - np.diag(np.diag(cov))
    assert np.allclose(off_diagonal, 0.0, atol=1e-10)


def test_pca_explained_variance_sums_to_total() -> None:
    rng = np.random.default_rng(999)
    x = rng.normal(size=(80, 4))
    z, _mean, _scale = linalg.standardize(x)
    components = linalg.pca_components(z, 4)
    scores = linalg.pca_scores(z, components)
    total_var = float(np.sum(np.var(z, axis=0)))
    score_var = float(np.sum(np.var(scores, axis=0)))
    assert score_var == pytest.approx(total_var, rel=1e-6)


def test_lasso_orthonormal_design_equals_soft_thresholding() -> None:
    # Under an orthonormal design Z.T @ Z / n = I, LASSO equals soft thresholding
    rng = np.random.default_rng(2026)
    n, p = 100, 5
    raw = rng.normal(size=(n, p))
    q, _r = np.linalg.qr(raw)
    z = q * np.sqrt(n)
    y = rng.normal(size=n)
    lam = 0.25
    _intercept, coef = linalg.lasso_fit(z, y, lam, tolerance=1e-10)
    ols = (z.T @ (y - y.mean())) / n
    expected = linalg.soft_threshold(ols, lam)
    assert np.allclose(coef, expected, atol=1e-6)


def test_lasso_kkt_conditions_at_solution() -> None:
    rng = np.random.default_rng(777)
    n, p = 80, 8
    x = rng.normal(size=(n, p))
    z, _mean, _scale = linalg.standardize(x)
    y = z @ np.array([1.5, -2.0, 0.0, 0.5, 0.0, -1.0, 0.0, 0.0]) + rng.normal(scale=0.5, size=n)
    lam = 0.3
    _intercept, coef = linalg.lasso_fit(z, y, lam, tolerance=1e-10, max_sweeps=5000)
    residual = y - y.mean() - z @ coef
    gradient = (z.T @ residual) / n
    # Subgradient optimality conditions:
    # If coef > 0: gradient = lam
    # If coef < 0: gradient = -lam
    # If coef == 0: |gradient| <= lam
    for j in range(p):
        if coef[j] > 1e-6:
            assert gradient[j] == pytest.approx(lam, abs=1e-4)
        elif coef[j] < -1e-6:
            assert gradient[j] == pytest.approx(-lam, abs=1e-4)
        else:
            assert abs(gradient[j]) <= lam + 1e-4


def test_lasso_lambda_max_zeros_all_coefficients() -> None:
    rng = np.random.default_rng(333)
    x = rng.normal(size=(50, 6))
    z, _mean, _scale = linalg.standardize(x)
    y = rng.normal(size=50)
    lam_max = linalg.lasso_lambda_max(z, y)
    _intercept, coef = linalg.lasso_fit(z, y, lam_max)
    assert np.all(coef == 0.0)
    _intercept2, coef2 = linalg.lasso_fit(z, y, lam_max * 1.5)
    assert np.all(coef2 == 0.0)


def test_lasso_approaches_least_squares_as_lambda_approaches_zero() -> None:
    rng = np.random.default_rng(555)
    n, p = 120, 4
    x = rng.normal(size=(n, p))
    z, _mean, _scale = linalg.standardize(x)
    y = z @ np.array([2.0, -1.0, 0.5, -0.5]) + rng.normal(scale=0.2, size=n)
    ols_coef, *_ = np.linalg.lstsq(z, y - y.mean(), rcond=None)
    _intercept, coef = linalg.lasso_fit(z, y, lam=1e-8, max_sweeps=5000)
    assert np.allclose(coef, ols_coef, atol=1e-4)


@given(st.integers(min_value=5, max_value=20), st.integers(min_value=2, max_value=5))
def test_standardize_never_uses_test_rows(n_train: int, n_features: int) -> None:
    rng = np.random.default_rng(101)
    train = rng.normal(size=(n_train, n_features))
    test1 = rng.normal(loc=100.0, scale=50.0, size=(10, n_features))
    test2 = rng.normal(loc=-50.0, scale=0.1, size=(5, n_features))

    z1, z_test1, mean1, scale1 = linalg.standardize(train, test1)
    z2, z_test2, mean2, scale2 = linalg.standardize(train, test2)
    z_only, mean_only, scale_only = linalg.standardize(train)

    assert np.array_equal(z1, z2)
    assert np.array_equal(z1, z_only)
    assert np.array_equal(mean1, mean2)
    assert np.array_equal(mean1, mean_only)
    assert np.array_equal(scale1, scale2)
    assert np.array_equal(scale1, scale_only)
