"""Guards for five behaviors that a small change to the model code would break silently."""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pytest

from macro_event_lab import nowcast
from macro_event_lab.arena import contestants, linalg


def test_lasso_converges_on_correlated_columns() -> None:
    """Catches mutation 4: LASSO stopping after 5 sweeps leaves large KKT residuals."""
    rng = np.random.default_rng(42)
    n = 100
    base = rng.normal(size=n)
    x = np.column_stack([
        base,
        base + 0.05 * rng.normal(size=n),
        rng.normal(size=n),
    ])
    z, _mean, _scale = linalg.standardize(x)
    y = 2.0 * z[:, 0] - 2.0 * z[:, 1] + 0.5 * z[:, 2]
    lam = 1e-3
    _intercept, coef = linalg.lasso_fit(z, y, lam)
    gradient = z.T @ (y - y.mean() - z @ coef) / n
    for j, value in enumerate(coef):
        if value != 0.0:
            assert gradient[j] == pytest.approx(lam * np.sign(value), abs=1e-5)
        else:
            assert abs(gradient[j]) <= lam + 1e-5


def test_missing_feature_uses_nonzero_training_mean_not_zero() -> None:
    """Catches mutation 5: filling missing features with zero instead of the training mean."""
    rng = np.random.default_rng(17)
    n = 35
    x = np.column_stack([
        100.0 + rng.normal(scale=2.0, size=n),
        rng.normal(size=n),
        rng.normal(size=n),
    ])
    y = 2.0 * x[:, 0] + 0.5 * x[:, 1] + 0.1 * rng.normal(size=n)
    release = [date(2010, 1, 1) + timedelta(days=30 * i) for i in range(n)]
    made_on = [r - timedelta(days=5) for r in release]

    x_train_missing = x[:34].copy()
    x_train_missing[0, 0] = np.nan
    col0_mean = float(np.nanmean(x_train_missing[:, 0]))
    x_train_filled = x_train_missing.copy()
    x_train_filled[0, 0] = col0_mean

    x_now_missing = x[34].copy()
    x_now_missing[0] = np.nan
    x_now_filled = x[34].copy()
    x_now_filled[0] = col0_mean

    origin = release[33]
    for fn in (
        contestants.ridge_forecast,
        contestants.factor_ridge_forecast,
        contestants.lasso_forecast,
    ):
        pred_missing = fn(
            x_train_missing, y[:34].tolist(), release[:34], made_on[:34], x_now_missing, origin,
        )
        pred_filled = fn(
            x_train_filled, y[:34].tolist(), release[:34], made_on[:34], x_now_filled, origin,
        )
        assert pred_missing == pytest.approx(pred_filled, abs=1e-10)


def test_factor_ridge_uses_more_than_one_factor_when_pc2_carries_signal() -> None:
    """Catches mutation 6: fixing the factor count at 1 misses signal on the second component."""
    rng = np.random.default_rng(7)
    n = 45
    u = rng.normal(size=n)
    v = rng.normal(size=n)
    x = np.column_stack([
        2.0 * u + 0.5 * v,
        2.0 * u - 0.5 * v,
        2.0 * u + 0.05 * rng.normal(size=n),
        rng.normal(scale=0.1, size=n),
    ])
    y = 4.0 * v
    release = [date(2010, 1, 1) + timedelta(days=30 * i) for i in range(n)]
    made_on = [r - timedelta(days=5) for r in release]

    pred = contestants.factor_ridge_forecast(
        x[:44], y[:44].tolist(), release[:44], made_on[:44], x[44], release[43],
    )
    assert pred == pytest.approx(float(y[44]), abs=0.5)


def test_ar_selects_higher_lag_for_ar2_process() -> None:
    """Catches mutation 7: fixing the AR lag at 1 fails on a noiseless AR(2) series."""
    series = [0.0, 5.0]
    for _ in range(38):
        series.append(-0.8 * series[-2] + 1.0)
    expected = -0.8 * series[-2] + 1.0
    forecast = contestants.ar_forecast(series)
    assert forecast == pytest.approx(expected, abs=1e-6)


def test_ridge_penalty_grid_includes_1000() -> None:
    """Catches mutation 8: dropping 1000.0 from LAMBDAS changes fallback and noisy shrinkage."""
    rng = np.random.default_rng(0)
    n, p = 35, 8
    x = rng.normal(size=(n, p))
    y = 3.0 + rng.normal(scale=2.0, size=n)
    released = [date(2010, 1, 1) + timedelta(days=30 * i) for i in range(n)]
    early_cutoffs = [released[0] - timedelta(days=1)] * n
    assert nowcast.choose_lambda(x, y, release_dates=released, as_of_dates=early_cutoffs) == 1000.0

    made_on = [r - timedelta(days=5) for r in released]
    pred = contestants.ridge_forecast(
        x[: n - 1], y[: n - 1].tolist(), released[: n - 1], made_on[: n - 1],
        x[n - 1], released[n - 2],
    )
    last = x[n - 1 : n]
    expected_1000 = float(nowcast.ridge_fit(x[: n - 1], y[: n - 1], 1000.0).predict(last)[0])
    expected_300 = float(nowcast.ridge_fit(x[: n - 1], y[: n - 1], 300.0).predict(last)[0])
    assert expected_1000 != pytest.approx(expected_300, abs=1e-3)
    assert pred == pytest.approx(expected_1000, abs=1e-10)
