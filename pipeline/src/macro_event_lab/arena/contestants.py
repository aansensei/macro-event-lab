"""Contestants that forecast one origin from what was public on its made_on date."""

from __future__ import annotations

import math
import warnings
from collections.abc import Sequence
from datetime import date

import numpy as np
import polars as pl

from macro_event_lab.arena import linalg, selection
from macro_event_lab.nowcast import (
    FEATURES,
    INDICATORS,
    MIN_TRAIN,
    choose_lambda,
    gdp_previous,
    quarter_value,
    ridge_fit,
    vintage,
)

MAX_AR_LAG = 4
MIN_AR_OBSERVATIONS = 20

KINDS = {
    "naive": "baseline", "ar": "classical", "ridge": "classical",
    "factor_ridge": "classical", "lasso": "classical", "spf": "human",
}
LABELS = {
    "naive": "Naive", "ar": "Autoregression", "ridge": "Ridge",
    "factor_ridge": "Factors and ridge", "lasso": "LASSO", "spf": "Professional forecasters",
}
NOTES = {
    "naive": "Repeats the previous first published number.",
    "ar": "Autoregression on first published numbers, lag chosen by BIC from 1 to 4.",
    "ridge": "Ridge regression on monthly indicators known on the forecast date.",
    "factor_ridge": "Principal components of the indicators, then ridge on one to four factors.",
    "lasso": "LASSO regression on the indicators known on the forecast date.",
    "spf": "Median of the Survey of Professional Forecasters for the current quarter.",
}


def naive_forecast(history: Sequence[float]) -> float | None:
    """The most recent first print known at the origin."""
    return history[-1] if history else None


def ar_forecast(
    history: Sequence[float], max_lag: int = MAX_AR_LAG,
    min_observations: int = MIN_AR_OBSERVATIONS,
) -> float | None:
    """One step ahead autoregression by least squares, lag by BIC on a common sample."""
    values = np.asarray(history, dtype=float)
    n = len(values)
    if n < min_observations:
        return None
    rows = n - max_lag
    target = values[max_lag:]
    best_bic, best_forecast = math.inf, None
    for lag in range(1, max_lag + 1):
        columns = [np.ones(rows)] + [values[max_lag - k : n - k] for k in range(1, lag + 1)]
        design = np.column_stack(columns)
        coefficients, *_ = np.linalg.lstsq(design, target, rcond=None)
        residual = float(np.sum((target - design @ coefficients) ** 2))
        bic = rows * math.log(max(residual, 1e-12) / rows) + (lag + 1) * math.log(rows)
        if bic < best_bic:
            latest = np.concatenate(([1.0], values[n - 1 : n - lag - 1 : -1]))
            best_bic, best_forecast = bic, float(latest @ coefficients)
    return best_forecast


def gdp_features(observations: pl.DataFrame, origins: pl.DataFrame) -> dict[date, np.ndarray]:
    """Nowcast features of each GDP origin from the vintages current on its made_on date."""
    by_series = {s: observations.filter(pl.col("series_id") == s) for s in [*INDICATORS, "GDPC1"]}
    features: dict[date, np.ndarray] = {}
    for row in origins.filter(pl.col("target") == "gdp").iter_rows(named=True):
        quarter, as_of = row["period"], row["made_on"]
        values = []
        for series, kind in INDICATORS.items():
            value = quarter_value(vintage(by_series[series], as_of), quarter, kind)
            values.append(math.nan if value is None else value)
        previous = gdp_previous(vintage(by_series["GDPC1"], as_of), quarter)
        values.append(math.nan if previous is None else previous)
        features[quarter] = np.asarray(values, dtype=float)
    return features


def _fill_missing(x: np.ndarray, means: np.ndarray) -> np.ndarray:
    return np.where(np.isnan(x), means, x)


def _training_matrix(
    train_x: np.ndarray, train_y: Sequence[float], train_release: Sequence[date],
    train_made_on: Sequence[date], made_on: date,
):
    """Rows whose answer was public on made_on, missing features set to the training mean.

    Returns the filled matrix, the targets, the release and forecast dates of the kept rows
    and the column means, or None when fewer than MIN_TRAIN rows qualify.
    """
    keep = [i for i, release in enumerate(train_release) if release <= made_on]
    if len(keep) < MIN_TRAIN:
        return None
    x = train_x[keep]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        means = np.nanmean(x, axis=0)
    means = np.where(np.isnan(means), 0.0, means)
    y = np.asarray([train_y[i] for i in keep], dtype=float)
    return (
        _fill_missing(x, means), y, [train_release[i] for i in keep],
        [train_made_on[i] for i in keep], means,
    )


def ridge_forecast(
    train_x: np.ndarray, train_y: Sequence[float], train_release: Sequence[date],
    train_made_on: Sequence[date], x_now: np.ndarray, made_on: date,
) -> float | None:
    """Ridge on rows whose answer was public on made_on; missing features take the training mean."""
    prepared = _training_matrix(train_x, train_y, train_release, train_made_on, made_on)
    if prepared is None:
        return None
    x, y, release, forecast_dates, means = prepared
    lam = choose_lambda(x, y, release_dates=release, as_of_dates=forecast_dates)
    model = ridge_fit(x, y, lam)
    return float(model.predict(_fill_missing(x_now, means).reshape(1, -1))[0])


FACTOR_COUNTS = (1, 2, 3, 4)
FACTOR_PENALTIES = (0.1, 1.0, 10.0, 100.0)


def _factor_fit_predict(
    candidate: tuple[int, float], x_train: np.ndarray, y_train: np.ndarray, x_test: np.ndarray,
) -> float:
    factors, lam = candidate
    factors = max(1, min(factors, x_train.shape[1], x_train.shape[0] - 1))
    z_train, z_test, _mean, _scale = linalg.standardize(x_train, x_test)
    components = linalg.pca_components(z_train, factors)
    model = ridge_fit(linalg.pca_scores(z_train, components), y_train, lam)
    return float(model.predict(linalg.pca_scores(z_test, components))[0])


def factor_ridge_forecast(
    train_x: np.ndarray, train_y: Sequence[float], train_release: Sequence[date],
    train_made_on: Sequence[date], x_now: np.ndarray, made_on: date,
) -> float | None:
    """Principal components of the standardized indicators, then ridge on 1 to 4 factors."""
    prepared = _training_matrix(train_x, train_y, train_release, train_made_on, made_on)
    if prepared is None:
        return None
    x, y, release, forecast_dates, means = prepared
    candidates = [(r, lam) for r in FACTOR_COUNTS for lam in FACTOR_PENALTIES]
    best = selection.select_candidate(
        candidates, x, y, release, forecast_dates, _factor_fit_predict,
    )
    return _factor_fit_predict(best, x, y, _fill_missing(x_now, means).reshape(1, -1))


def _lasso_fit_predict(
    lam: float, x_train: np.ndarray, y_train: np.ndarray, x_test: np.ndarray,
) -> float:
    z_train, z_test, _mean, _scale = linalg.standardize(x_train, x_test)
    intercept, coefficients = linalg.lasso_fit(z_train, y_train, lam)
    return float(intercept + z_test[0] @ coefficients)


def lasso_forecast(
    train_x: np.ndarray, train_y: Sequence[float], train_release: Sequence[date],
    train_made_on: Sequence[date], x_now: np.ndarray, made_on: date,
) -> float | None:
    """LASSO on the standardized indicators with the penalty chosen by the inner walk forward."""
    prepared = _training_matrix(train_x, train_y, train_release, train_made_on, made_on)
    if prepared is None:
        return None
    x, y, release, forecast_dates, means = prepared
    grid = linalg.lasso_grid(linalg.standardize(x)[0], y)
    best = selection.select_candidate(grid, x, y, release, forecast_dates, _lasso_fit_predict)
    return _lasso_fit_predict(best, x, y, _fill_missing(x_now, means).reshape(1, -1))


def spf_forecast(survey: pl.DataFrame, period: date, made_on: date) -> float | None:
    """The survey median for the current quarter, only if it was published by made_on."""
    quarter = (period.month - 1) // 3 + 1
    rows = survey.filter(
        (pl.col("variable") == "gdp") & (pl.col("horizon") == 0)
        & (pl.col("survey_year") == period.year) & (pl.col("survey_quarter") == quarter)
        & (pl.col("statistic") == "median")
        & (pl.col("known_from").dt.convert_time_zone("America/New_York").dt.date() <= made_on)
    )
    return float(rows["value"][0]) if rows.height else None


__all__ = [
    "FEATURES", "KINDS", "LABELS", "NOTES", "ar_forecast", "gdp_features", "naive_forecast",
    "ridge_forecast", "spf_forecast", "factor_ridge_forecast", "lasso_forecast",
]
