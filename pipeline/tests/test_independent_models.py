from __future__ import annotations

import ast
from datetime import date, timedelta
from pathlib import Path

import independent_models as ind
import numpy as np
import pytest

from macro_event_lab.arena.contestants import (
    ar_forecast,
    factor_ridge_forecast,
    lasso_forecast,
    ridge_forecast,
)
from macro_event_lab.nowcast import choose_lambda

PANEL_SPECS: list[tuple[int, int, bool, bool]] = [
    (101, 60, False, False),
    (202, 72, False, False),
    (303, 84, False, False),
    (404, 90, False, False),
    (505, 76, True, False),
    (606, 80, False, True),
]

LASSO_PANEL_SPECS: list[tuple[int, int, bool, bool]] = [
    (101, 60, False, False),
    (202, 72, False, False),
    (303, 84, False, False),
    (505, 76, True, False),
    (606, 80, False, True),
]

def make_synthetic_panel(
    seed: int,
    n_rows: int,
    *,
    near_collinear: bool = False,
    with_outlier: bool = False,
) -> tuple[np.ndarray, np.ndarray, list[date], list[date], np.ndarray, date]:
    rng = np.random.default_rng(seed)
    x = rng.normal(0.0, 1.0, size=(n_rows, 6))
    if near_collinear:
        x[:, 5] = x[:, 0] + rng.normal(0.0, 1e-4, size=n_rows)

    weights = np.array([1.4, -0.8, 0.5, 0.0, 0.9, -0.3], dtype=float)
    y = 2.0 + x @ weights + rng.normal(0.0, 0.25, size=n_rows)

    if with_outlier:
        outlier_idx = n_rows // 2
        x[outlier_idx, 1] = 12.0
        y[outlier_idx] = 25.0

    missing_mask = rng.random(size=(n_rows, 6)) < 0.06
    x[missing_mask] = np.nan
    x_now = rng.normal(0.0, 1.0, size=6)
    if near_collinear:
        x_now[5] = x_now[0] + float(rng.normal(0.0, 1e-4))
    x_now[2] = np.nan

    start = date(2015, 1, 15)
    train_made_on = [start + timedelta(days=30 * idx) for idx in range(n_rows)]
    train_release = [d + timedelta(days=20) for d in train_made_on]
    made_on = train_made_on[-1] + timedelta(days=35)
    return x, y, train_release, train_made_on, x_now, made_on


def make_synthetic_series(seed: int, n_rows: int, *, with_outlier: bool = False) -> list[float]:
    rng = np.random.default_rng(seed)
    lag = (seed % 3) + 1
    coefs = [0.5, -0.25, 0.15][:lag]
    series = [float(rng.normal(1.0, 0.5)) for _ in range(lag)]
    for _ in range(lag, n_rows):
        val = (
            0.4
            + sum(coefs[k] * series[-1 - k] for k in range(lag))
            + float(rng.normal(0.0, 0.2))
        )
        series.append(val)
    if with_outlier:
        series[n_rows // 2] = 18.0
    return series


def test_independent_models_imports_only_stdlib_and_numpy() -> None:
    path = Path(__file__).with_name("independent_models.py")
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert not alias.name.startswith("macro_event_lab")
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            assert not node.module.startswith("macro_event_lab")


@pytest.mark.parametrize(("seed", "n_rows", "collinear", "outlier"), PANEL_SPECS)
def test_ridge_matches_independent_implementation(
    seed: int,
    n_rows: int,
    collinear: bool,
    outlier: bool,
) -> None:
    x, y, rel, made, x_now, origin = make_synthetic_panel(
        seed, n_rows, near_collinear=collinear, with_outlier=outlier
    )
    prod = ridge_forecast(x, y, rel, made, x_now, origin)
    indep_res = ind.ridge_forecast_with_choice(x, y, rel, made, x_now, origin)
    assert prod is not None
    assert indep_res is not None
    indep, ind_lam = indep_res
    assert abs(prod - indep) <= 1e-8

    x_filled, _ = ind.impute_missing_means(x, x_now)
    prod_lam = choose_lambda(x_filled, y, release_dates=rel, as_of_dates=made)
    assert prod_lam == ind_lam


@pytest.mark.parametrize(("seed", "n_rows", "collinear", "outlier"), PANEL_SPECS)
def test_factor_ridge_matches_independent_implementation(
    seed: int,
    n_rows: int,
    collinear: bool,
    outlier: bool,
) -> None:
    x, y, rel, made, x_now, origin = make_synthetic_panel(
        seed, n_rows, near_collinear=collinear, with_outlier=outlier
    )
    prod = factor_ridge_forecast(x, y, rel, made, x_now, origin)
    indep = ind.factor_ridge_forecast(x, y, rel, made, x_now, origin)
    assert prod is not None
    assert indep is not None
    assert abs(prod - indep) <= 1e-8


@pytest.mark.parametrize(("seed", "n_rows", "collinear", "outlier"), LASSO_PANEL_SPECS)
def test_lasso_matches_independent_implementation(
    seed: int,
    n_rows: int,
    collinear: bool,
    outlier: bool,
) -> None:
    x, y, rel, made, x_now, origin = make_synthetic_panel(
        seed, n_rows, near_collinear=collinear, with_outlier=outlier
    )
    prod = lasso_forecast(x, y, rel, made, x_now, origin)
    indep = ind.lasso_forecast(x, y, rel, made, x_now, origin)
    assert prod is not None
    assert indep is not None
    assert abs(prod - indep) <= 1e-6


@pytest.mark.parametrize(
    ("seed", "n_rows", "outlier"),
    [
        (101, 60, False),
        (202, 72, False),
        (303, 84, False),
        (404, 90, False),
        (606, 80, True),
    ],
)
def test_ar_matches_independent_implementation(seed: int, n_rows: int, outlier: bool) -> None:
    series = make_synthetic_series(seed, n_rows, with_outlier=outlier)
    prod = ar_forecast(series)
    indep = ind.ar_forecast(series)
    assert prod is not None
    assert indep is not None
    assert abs(prod - indep) <= 1e-6


def test_short_inputs_return_none_in_both_implementations() -> None:
    x, y, rel, made, x_now, origin = make_synthetic_panel(101, 19)
    assert ridge_forecast(x, y, rel, made, x_now, origin) is None
    assert ind.ridge_forecast(x, y, rel, made, x_now, origin) is None
    assert factor_ridge_forecast(x, y, rel, made, x_now, origin) is None
    assert ind.factor_ridge_forecast(x, y, rel, made, x_now, origin) is None
    assert lasso_forecast(x, y, rel, made, x_now, origin) is None
    assert ind.lasso_forecast(x, y, rel, made, x_now, origin) is None
    short_series = make_synthetic_series(101, 19)
    assert ar_forecast(short_series) is None
    assert ind.ar_forecast(short_series) is None
