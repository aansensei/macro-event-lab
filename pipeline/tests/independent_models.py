from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from datetime import date
from typing import TypeVar

import numpy as np

RIDGE_PENALTIES: tuple[float, ...] = (
    0.01,
    0.1,
    1.0,
    3.0,
    10.0,
    30.0,
    100.0,
    300.0,
    1000.0,
)
FACTOR_COUNTS: tuple[int, ...] = (1, 2, 3, 4)
FACTOR_PENALTIES: tuple[float, ...] = (0.1, 1.0, 10.0, 100.0)
LASSO_GRID_SIZE = 30
LASSO_MAX_SWEEPS = 5000
LASSO_TOL = 1e-8
INNER_WINDOW = 8
MIN_MULTIVARIATE_OBS = 20

CandidateT = TypeVar("CandidateT")


def filter_public_rows(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    made_on: date,
    min_observations: int = MIN_MULTIVARIATE_OBS,
) -> tuple[np.ndarray, np.ndarray, list[date], list[date]] | None:
    # EVAL_PROTOCOL.md sec 3 and roster: keep release <= made_on, at least 20 rows.
    x_arr = np.asarray(train_x, dtype=float)
    y_arr = np.asarray(list(train_y), dtype=float)
    kept = [
        idx
        for idx, rel in enumerate(train_release)
        if rel <= made_on and math.isfinite(float(y_arr[idx]))
    ]
    if len(kept) < min_observations:
        return None
    return (
        x_arr[kept],
        y_arr[kept],
        [train_release[idx] for idx in kept],
        [train_made_on[idx] for idx in kept],
    )


def impute_missing_means(
    train_x: np.ndarray,
    x_now: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    # EVAL_PROTOCOL.md roster: missing feature takes training mean, or zero if all missing.
    x_filled = np.array(train_x, dtype=float, copy=True)
    now_filled = np.array(x_now, dtype=float, copy=True).reshape(-1)
    n_cols = x_filled.shape[1]
    for col in range(n_cols):
        observed = np.isfinite(x_filled[:, col])
        fill_value = float(np.mean(x_filled[observed, col])) if np.any(observed) else 0.0
        if not np.all(observed):
            x_filled[~observed, col] = fill_value
        if not math.isfinite(float(now_filled[col])):
            now_filled[col] = fill_value
    return x_filled, now_filled


def standardize_matrix(
    train_x: np.ndarray,
    test_row: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    # EVAL_PROTOCOL.md roster: standardize with training mean and population std (divisor n).
    mean = np.mean(train_x, axis=0)
    std = np.std(train_x, axis=0, ddof=0)
    scale = np.where(std == 0.0, 1.0, std)
    return (train_x - mean) / scale, (test_row - mean) / scale


def fit_predict_ridge(
    train_x: np.ndarray,
    train_y: np.ndarray,
    test_row: np.ndarray,
    lam: float,
) -> float:
    # docs/MODELS.md Ridge: solve (Z'Z + lambda I)^(-1) Z'(y - ybar), predict ybar + z_now beta.
    z_train, z_test = standardize_matrix(train_x, test_row)
    y_bar = float(np.mean(train_y))
    y_centered = train_y - y_bar
    n_features = z_train.shape[1]
    system = z_train.T @ z_train + lam * np.eye(n_features, dtype=float)
    rhs = z_train.T @ y_centered
    beta = np.linalg.solve(system, rhs)
    return float(y_bar + z_test @ beta)


def fit_predict_factor_ridge(
    train_x: np.ndarray,
    train_y: np.ndarray,
    test_row: np.ndarray,
    n_factors: int,
    lam: float,
) -> float:
    # docs/MODELS.md Factor ridge: SVD components Z V_r then ridge fit of y on scores F.
    z_train, z_test = standardize_matrix(train_x, test_row)
    n_rows, n_cols = z_train.shape
    r_eff = max(1, min(n_factors, n_cols, n_rows - 1))
    _, _, vt = np.linalg.svd(z_train, full_matrices=False)
    components = vt[:r_eff]
    scores_train = z_train @ components.T
    scores_test = z_test @ components.T
    return fit_predict_ridge(scores_train, train_y, scores_test, lam)


def lasso_penalty_grid(
    train_x: np.ndarray,
    train_y: np.ndarray,
    n_penalties: int = LASSO_GRID_SIZE,
) -> list[float]:
    # EVAL_PROTOCOL.md roster: 30 geometric penalties from lambda_max to lambda_max / 1000.
    z_train, _ = standardize_matrix(train_x, train_x[0])
    y_centered = train_y - float(np.mean(train_y))
    n_rows = z_train.shape[0]
    lam_max = float(np.max(np.abs(z_train.T @ y_centered)) / n_rows)
    if lam_max <= 0.0:
        return [0.0]
    grid = np.geomspace(lam_max, lam_max / 1000.0, num=n_penalties)
    return [float(val) for val in grid]


def soft_threshold(value: float, threshold: float) -> float:
    # docs/MODELS.md LASSO: soft(v, t) = sign(v) * max(|v| - t, 0).
    if value > threshold:
        return value - threshold
    if value < -threshold:
        return value + threshold
    return 0.0


def fit_predict_lasso(
    train_x: np.ndarray,
    train_y: np.ndarray,
    test_row: np.ndarray,
    lam: float,
    max_sweeps: int = LASSO_MAX_SWEEPS,
    tol: float = LASSO_TOL,
) -> float:
    # EVAL_PROTOCOL.md roster: coordinate descent stopping below 1e-8 or after 5000 sweeps.
    z_train, z_test = standardize_matrix(train_x, test_row)
    y_bar = float(np.mean(train_y))
    residual = np.array(train_y - y_bar, dtype=float, copy=True)
    n_rows, n_cols = z_train.shape
    col_norms = np.mean(z_train * z_train, axis=0)
    beta = np.zeros(n_cols, dtype=float)

    for _ in range(max_sweeps):
        max_change = 0.0
        for col in range(n_cols):
            c_j = float(col_norms[col])
            if c_j == 0.0:
                continue
            old_val = float(beta[col])
            z_col = z_train[:, col]
            rho = float(np.dot(z_col, residual) / n_rows + c_j * old_val)
            new_val = soft_threshold(rho, lam) / c_j
            if abs(new_val) <= 1e-15:
                new_val = 0.0
            delta = new_val - old_val
            if delta != 0.0:
                residual -= z_col * delta
                beta[col] = new_val
                change = abs(delta)
                if change > max_change:
                    max_change = change
        if max_change < tol:
            break

    return float(y_bar + z_test @ beta)


def inner_walk_forward_select(
    train_x: np.ndarray,
    train_y: np.ndarray,
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    candidates: Sequence[CandidateT],
    fit_predict: Callable[[np.ndarray, np.ndarray, np.ndarray, CandidateT], float],
    window: int = INNER_WINDOW,
) -> CandidateT:
    # EVAL_PROTOCOL.md sec 5: inner walk forward over last 8 rows using earlier public data.
    n_rows = train_x.shape[0]
    start_val = max(2, n_rows - window)
    totals = [0.0 for _ in candidates]
    n_scored = 0

    for val_idx in range(start_val, n_rows):
        val_made_on = train_made_on[val_idx]
        inner_idx = [j for j in range(val_idx) if train_release[j] <= val_made_on]
        if len(inner_idx) < 2:
            continue
        x_sub = train_x[inner_idx]
        y_sub = train_y[inner_idx]
        x_val = train_x[val_idx]
        y_val = float(train_y[val_idx])
        n_scored += 1
        for cand_idx, cand in enumerate(candidates):
            pred = fit_predict(x_sub, y_sub, x_val, cand)
            totals[cand_idx] += (y_val - pred) ** 2

    if n_scored == 0:
        return candidates[-1]

    best_idx = 0
    best_err = totals[0]
    for idx in range(1, len(candidates)):
        if totals[idx] < best_err:
            best_err = totals[idx]
            best_idx = idx
    return candidates[best_idx]


def ridge_forecast_with_choice(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> tuple[float, float] | None:
    # EVAL_PROTOCOL.md roster: choose ridge lambda from grid by inner walk forward over 8 rows.
    filtered = filter_public_rows(train_x, train_y, train_release, train_made_on, made_on)
    if filtered is None:
        return None
    x_kept, y_kept, rel_kept, made_kept = filtered
    x_filled, now_filled = impute_missing_means(x_kept, x_now)
    chosen_lam = inner_walk_forward_select(
        x_filled,
        y_kept,
        rel_kept,
        made_kept,
        RIDGE_PENALTIES,
        fit_predict_ridge,
    )
    forecast = fit_predict_ridge(x_filled, y_kept, now_filled, chosen_lam)
    return forecast, chosen_lam


def ridge_forecast(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> float | None:
    # docs/MODELS.md Ridge regression: return forecast or None when fewer than 20 rows qualify.
    res = ridge_forecast_with_choice(
        train_x, train_y, train_release, train_made_on, x_now, made_on
    )
    return None if res is None else res[0]


def factor_ridge_forecast_with_choice(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> tuple[float, tuple[int, float]] | None:
    # EVAL_PROTOCOL.md roster: choose (r, lambda) pair with smallest inner walk forward error.
    filtered = filter_public_rows(train_x, train_y, train_release, train_made_on, made_on)
    if filtered is None:
        return None
    x_kept, y_kept, rel_kept, made_kept = filtered
    x_filled, now_filled = impute_missing_means(x_kept, x_now)
    candidates = [(r, lam) for r in FACTOR_COUNTS for lam in FACTOR_PENALTIES]

    def _fit_pred(
        x_sub: np.ndarray,
        y_sub: np.ndarray,
        x_val: np.ndarray,
        cand: tuple[int, float],
    ) -> float:
        # docs/MODELS.md Factor ridge: delegate candidate evaluation for (r, lambda).
        return fit_predict_factor_ridge(x_sub, y_sub, x_val, cand[0], cand[1])

    chosen = inner_walk_forward_select(
        x_filled,
        y_kept,
        rel_kept,
        made_kept,
        candidates,
        _fit_pred,
    )
    forecast = fit_predict_factor_ridge(x_filled, y_kept, now_filled, chosen[0], chosen[1])
    return forecast, chosen


def factor_ridge_forecast(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> float | None:
    # docs/MODELS.md Factor ridge: return forecast or None when fewer than 20 rows qualify.
    res = factor_ridge_forecast_with_choice(
        train_x, train_y, train_release, train_made_on, x_now, made_on
    )
    return None if res is None else res[0]


def lasso_forecast_with_choice(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> tuple[float, float] | None:
    # EVAL_PROTOCOL.md roster: compute grid on kept window and choose via inner walk forward.
    filtered = filter_public_rows(train_x, train_y, train_release, train_made_on, made_on)
    if filtered is None:
        return None
    x_kept, y_kept, rel_kept, made_kept = filtered
    x_filled, now_filled = impute_missing_means(x_kept, x_now)
    grid = lasso_penalty_grid(x_filled, y_kept)
    chosen_lam = inner_walk_forward_select(
        x_filled,
        y_kept,
        rel_kept,
        made_kept,
        grid,
        fit_predict_lasso,
    )
    forecast = fit_predict_lasso(x_filled, y_kept, now_filled, chosen_lam)
    return forecast, chosen_lam


def lasso_forecast(
    train_x: np.ndarray,
    train_y: Sequence[float],
    train_release: Sequence[date],
    train_made_on: Sequence[date],
    x_now: np.ndarray,
    made_on: date,
) -> float | None:
    # docs/MODELS.md LASSO: return forecast or None when fewer than 20 rows qualify.
    res = lasso_forecast_with_choice(
        train_x, train_y, train_release, train_made_on, x_now, made_on
    )
    return None if res is None else res[0]


def ar_forecast_with_choice(
    history: Sequence[float],
    max_lag: int = 4,
    min_observations: int = 20,
) -> tuple[float, int] | None:
    # docs/MODELS.md Autoregression: lag 1 to 4 by BIC on a common sample, forecast with its fit.
    y = np.asarray(list(history), dtype=float)
    y = y[np.isfinite(y)]
    if y.size < min_observations:
        return None
    effective_max_lag = min(max_lag, y.size - 2)
    if effective_max_lag < 1:
        return None

    start = effective_max_lag
    n_common = y.size - start
    y_common = y[start:]

    best_lag = 1
    best_bic = math.inf
    best_coef = np.zeros(2)
    for lag in range(1, effective_max_lag + 1):
        cols = [np.ones(n_common, dtype=float)]
        for k in range(1, lag + 1):
            cols.append(y[start - k : y.size - k])
        x_common = np.column_stack(cols)
        coef, *_ = np.linalg.lstsq(x_common, y_common, rcond=None)
        residuals = y_common - x_common @ coef
        rss = float(np.sum(residuals * residuals))
        sigma2 = max(rss / n_common, 1e-15)
        bic = n_common * math.log(sigma2) + (lag + 1) * math.log(n_common)
        if bic < best_bic:
            best_bic = bic
            best_lag = lag
            best_coef = coef

    # the forecast uses the coefficients of the common sample fit, with no refit after the choice
    x_next = np.array([1.0] + [float(y[-k]) for k in range(1, best_lag + 1)], dtype=float)
    return float(x_next @ best_coef), best_lag


def ar_forecast(
    history: Sequence[float],
    max_lag: int = 4,
    min_observations: int = 20,
) -> float | None:
    # EVAL_PROTOCOL.md sec 4: autoregression by least squares, lag chosen by BIC from 1 to 4.
    res = ar_forecast_with_choice(history, max_lag=max_lag, min_observations=min_observations)
    return None if res is None else res[0]
