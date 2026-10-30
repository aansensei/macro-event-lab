"""Fixed-prior MAP calibration with shared effects and series deviations.

Gaussian prior scales are fixed, not learned from outcomes. Temporal evaluation is handled
by model_evaluation; these coefficients do not estimate posterior uncertainty.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.model import calibration_rows

SERIES = ("KXCPI", "KXPAYROLLS", "KXGDP", "KXFED")


def sigmoid(z: np.ndarray) -> np.ndarray:
    """Stable inverse logit, including very large positive or negative inputs."""
    return np.exp(-np.logaddexp(0.0, -z))


def objective(
    w: np.ndarray, x: np.ndarray, y: np.ndarray, weights: np.ndarray,
    prior: np.ndarray, precision: np.ndarray,
) -> float:
    """Weighted Bernoulli negative log likelihood plus a Gaussian prior penalty."""
    z = x @ w
    delta = w - prior
    return float(weights @ (np.logaddexp(0.0, z) - y * z) + 0.5 * (precision * delta) @ delta)


@dataclass(frozen=True)
class MapFit:
    coef: np.ndarray
    iterations: int
    gradient_norm: float
    singular_values: np.ndarray

    def predict(self, x: np.ndarray) -> np.ndarray:
        return sigmoid(x @ self.coef)


def fit_map(
    x: np.ndarray, y: np.ndarray, *, prior: np.ndarray | None = None,
    precision: np.ndarray | None = None, weights: np.ndarray | None = None,
    method: str = "irls", tol: float = 1e-8, max_iter: int = 10000,
) -> MapFit:
    """Solve a strictly convex fixed-prior MAP problem by IRLS or gradient descent.

    IRLS uses an augmented weighted least-squares solve. Backtracking decreases the objective.
    Gradient descent uses 1/L, with L bounded by ||sqrt(weight) X||_2^2 / 4 + max(precision).
    """
    x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    if x.ndim != 2 or y.shape != (len(x),) or len(y) == 0:
        raise ValueError("x and y must contain matching nonempty rows")
    p = x.shape[1]
    prior = np.zeros(p) if prior is None else np.asarray(prior, dtype=float)
    precision = np.ones(p) if precision is None else np.asarray(precision, dtype=float)
    weights = np.ones(len(y)) if weights is None else np.asarray(weights, dtype=float)
    if prior.shape != (p,) or precision.shape != (p,) or weights.shape != y.shape:
        raise ValueError("prior, precision and weights must match the design")
    if not all(np.isfinite(a).all() for a in (x, y, prior, precision, weights)):
        raise ValueError("all inputs must be finite")
    if not np.isin(y, [0, 1]).all() or (precision <= 0).any() or (weights <= 0).any():
        raise ValueError("labels must be binary; precision and weights must be positive")
    if method not in ("irls", "gd") or tol <= 0 or max_iter < 1:
        raise ValueError("invalid solver settings")
    singular = np.linalg.svd(np.sqrt(weights)[:, None] * x, compute_uv=False)
    lipschitz = singular[0] ** 2 / 4 + precision.max()
    w = prior.copy()
    for iteration in range(max_iter):
        prob = sigmoid(x @ w)
        gradient = x.T @ (weights * (prob - y)) + precision * (w - prior)
        norm = float(np.linalg.norm(gradient, ord=np.inf))
        if norm <= tol:
            return MapFit(w, iteration, norm, singular)
        if method == "gd":
            w -= gradient / lipschitz
            continue
        curvature = np.maximum(prob * (1 - prob), 1e-12)
        root = np.sqrt(weights * curvature)
        design = np.vstack([root[:, None] * x, np.diag(np.sqrt(precision))])
        response = np.concatenate([
            np.sqrt(weights) * (y - prob) / np.sqrt(curvature),
            np.sqrt(precision) * (prior - w),
        ])
        step = np.linalg.lstsq(design, response, rcond=None)[0]
        before = objective(w, x, y, weights, prior, precision)
        scale = 1.0
        while objective(w + scale * step, x, y, weights, prior, precision) > (
            before + 1e-4 * scale * float(gradient @ step) + 1e-12
        ):
            scale *= 0.5
            if scale < 1e-12:
                raise RuntimeError("MAP line search did not converge")
        w += scale * step
    raise RuntimeError("MAP solver did not converge within max_iter")


def calibration_design(rows: pl.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Shared intercept/logit and per-series deviations; each event has total weight one."""
    if rows.is_empty() or not set(rows["series_ticker"].to_list()).issubset(SERIES):
        raise ValueError("calibration requires rows from the four supported series")
    logits = rows["market_logit"].to_numpy()
    indicators = np.column_stack([
        (rows["series_ticker"] == s).to_numpy().astype(float) for s in SERIES
    ])
    x = np.column_stack([np.ones(rows.height), logits, indicators, indicators * logits[:, None]])
    weights = rows.select(1.0 / pl.len().over("event_ticker")).to_series().to_numpy()
    return x, rows["outcome"].to_numpy(), weights


def fit_calibration(rows: pl.DataFrame, prior_sd: float = 1.0) -> tuple[pl.DataFrame, MapFit]:
    """Fit shared and series effects with a fixed Gaussian prior SD."""
    if not np.isfinite(prior_sd) or prior_sd <= 0:
        raise ValueError("prior_sd must be finite and positive")
    x, y, weights = calibration_design(rows)
    prior = np.zeros(x.shape[1])
    prior[1] = 1.0
    fit = fit_map(x, y, prior=prior, weights=weights,
                  precision=np.full(x.shape[1], 1 / prior_sd**2))
    result = pl.DataFrame({
        "series_ticker": SERIES,
        "bias": fit.coef[0] + fit.coef[2:6],
        "confidence": fit.coef[1] + fit.coef[6:10],
        "n_events": [rows.filter(pl.col("series_ticker") == s)["event_ticker"].n_unique()
                     for s in SERIES],
    })
    return result, fit


def build_calibration(paths: Paths) -> dict[str, int]:
    """Write local MAP coefficients, temporal predictions and paired event scores."""
    from macro_event_lab import model_evaluation

    markets = pl.read_parquet(paths.silver / "kalshi_markets.parquet")
    rows = model_evaluation.attach_label_times(calibration_rows(
        pl.read_parquet(paths.gold / "implied_survival.parquet"),
        pl.read_parquet(paths.gold / "implied_stats.parquet"),
        markets,
    ), markets)
    coefficients, _ = fit_calibration(rows)
    predictions = model_evaluation.walk_forward(rows)
    sensitivity = model_evaluation.prior_sensitivity(rows, predictions)
    tables = {"calibration_rows": rows, "calibration_map": coefficients,
              "calibration_predictions": predictions,
              "model_scores": sensitivity.filter(pl.col("prior_sd") == 1.0),
              "model_sensitivity": sensitivity}
    for name, frame in tables.items():
        frame.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    return {name: frame.height for name, frame in tables.items()}
