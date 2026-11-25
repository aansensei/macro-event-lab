"""Split conformal intervals on a rolling window of absolute errors."""

from __future__ import annotations

import math
from collections.abc import Sequence

from macro_event_lab.arena.metrics import EDGE_TOLERANCE

WINDOW = 40
LEVEL = 0.9


def conformal_half_width(
    residuals: Sequence[float], level: float = LEVEL, window: int = WINDOW,
) -> float | None:
    """Half width from the last `window` absolute residuals, None when fewer exist.

    With n residuals the half width is the value at position ceil((n + 1) * level) of the
    sorted absolute residuals, which needs n + 1 to be at least 1 / (1 - level).
    """
    recent = [abs(r) for r in residuals][-window:]
    if len(recent) < window:
        return None
    position = math.ceil((len(recent) + 1) * level)
    if position > len(recent):
        return None
    return sorted(recent)[position - 1]


def interval(point: float, half_width: float | None) -> tuple[float, float] | None:
    if half_width is None:
        return None
    return point - half_width, point + half_width


def aci_coverage(
    errors_in_time_order: Sequence[float],
    level: float = LEVEL,
    gamma: float = 0.01,
    window: int = WINDOW,
) -> dict[str, int | float | None]:
    """Adaptive conformal inference coverage sensitivity check over a rolling window."""
    if window < 1:
        raise ValueError("window must be positive")
    abs_errors = [abs(float(e)) for e in errors_in_time_order]
    if len(abs_errors) <= window:
        return {"n": 0, "coverage": None}
    alpha = 1.0 - level
    n_scored = 0
    hits = 0
    for t in range(window, len(abs_errors)):
        calib = sorted(abs_errors[t - window : t])
        m = len(calib)
        if alpha <= 0.0:
            half_width = math.inf
        else:
            position = math.ceil((m + 1) * (1.0 - alpha))
            if position > m:
                half_width = math.inf
            elif position < 1:
                half_width = -math.inf
            else:
                half_width = calib[position - 1]
        miss = 1 if abs_errors[t] > half_width + EDGE_TOLERANCE else 0
        hits += 1 - miss
        n_scored += 1
        alpha = min(1.0, max(0.0, alpha + gamma * ((1.0 - level) - miss)))
    return {"n": n_scored, "coverage": hits / n_scored if n_scored > 0 else None}
