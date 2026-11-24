"""Standardization, principal components and the LASSO, written with numpy only."""

from __future__ import annotations

import numpy as np

LASSO_TOLERANCE = 1e-8
LASSO_MAX_SWEEPS = 5000
LASSO_GRID_SIZE = 30
LASSO_GRID_RATIO = 1e-3


def standardize(train: np.ndarray, other: np.ndarray | None = None):
    """Standardize with the mean and standard deviation of the training rows only."""
    mean = train.mean(axis=0)
    scale = train.std(axis=0)
    scale = np.where(scale == 0, 1.0, scale)
    z_train = (train - mean) / scale
    if other is None:
        return z_train, mean, scale
    return z_train, (other - mean) / scale, mean, scale


def pca_components(z: np.ndarray, n_components: int) -> np.ndarray:
    """Principal directions (rows) from the singular value decomposition of centered data.

    The sign of each direction is fixed so that its largest absolute loading is positive.
    """
    _u, _s, vt = np.linalg.svd(z, full_matrices=False)
    components = vt[:n_components].copy()
    for row in components:
        if row[np.argmax(np.abs(row))] < 0:
            row *= -1.0
    return components


def pca_scores(z: np.ndarray, components: np.ndarray) -> np.ndarray:
    return z @ components.T


def soft_threshold(value: np.ndarray | float, threshold: float):
    return np.sign(value) * np.maximum(np.abs(value) - threshold, 0.0)


def lasso_lambda_max(z: np.ndarray, y: np.ndarray) -> float:
    """The smallest penalty that sets every coefficient to zero."""
    return float(np.max(np.abs(z.T @ (y - y.mean()))) / len(y))


def lasso_grid(z: np.ndarray, y: np.ndarray) -> list[float]:
    top = lasso_lambda_max(z, y)
    if top <= 0:
        return [0.0]
    return list(np.geomspace(top, top * LASSO_GRID_RATIO, LASSO_GRID_SIZE))


def lasso_fit(
    z: np.ndarray, y: np.ndarray, lam: float,
    tolerance: float = LASSO_TOLERANCE, max_sweeps: int = LASSO_MAX_SWEEPS,
) -> tuple[float, np.ndarray]:
    """Coordinate descent for (1 / 2n) * |y - b0 - Z b|^2 + lam * |b|_1 on standardized columns.

    Returns the intercept (the mean of y, because the columns are centered) and the coefficients.
    """
    n, p = z.shape
    centered = y - y.mean()
    coef = np.zeros(p)
    residual = centered.copy()
    column_norm = (z * z).sum(axis=0) / n
    for _ in range(max_sweeps):
        largest_change = 0.0
        for j in range(p):
            if column_norm[j] == 0:
                continue
            old = coef[j]
            rho = float(z[:, j] @ residual) / n + column_norm[j] * old
            new = float(soft_threshold(rho, lam)) / column_norm[j]
            if new != old:
                residual -= z[:, j] * (new - old)
                coef[j] = new
                largest_change = max(largest_change, abs(new - old))
        if largest_change < tolerance:
            break
    return float(y.mean()), coef
