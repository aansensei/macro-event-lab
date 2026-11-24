"""Penalty and factor count selection by an inner walk forward that respects publication dates."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from datetime import date
from typing import TypeVar

import numpy as np

from macro_event_lab.nowcast import INNER

Candidate = TypeVar("Candidate")


def inner_splits(
    n: int, release_dates: Sequence[date], as_of_dates: Sequence[date], inner: int = INNER,
) -> list[tuple[list[int], int]]:
    """Validation rows are the last `inner` rows; each may train only on rows whose answer was
    public on that row's own forecast date."""
    start = max(2, n - inner)
    splits = []
    for i in range(start, n):
        train = [j for j in range(i) if release_dates[j] <= as_of_dates[i]]
        if len(train) >= 2:
            splits.append((train, i))
    return splits


def select_candidate(
    candidates: Sequence[Candidate], x: np.ndarray, y: np.ndarray,
    release_dates: Sequence[date], as_of_dates: Sequence[date],
    fit_predict: Callable[[Candidate, np.ndarray, np.ndarray, np.ndarray], float],
) -> Candidate:
    """The candidate with the smallest squared error over the inner splits."""
    splits = inner_splits(len(y), release_dates, as_of_dates)
    if not splits:
        return candidates[-1]
    best, best_error = candidates[0], float("inf")
    for candidate in candidates:
        error = sum(
            (fit_predict(candidate, x[train], y[train], x[i : i + 1]) - y[i]) ** 2
            for train, i in splits
        )
        if error < best_error:
            best, best_error = candidate, error
    return best
