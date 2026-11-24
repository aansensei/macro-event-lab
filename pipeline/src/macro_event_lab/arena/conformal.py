"""Split conformal intervals on a rolling window of absolute errors."""

from __future__ import annotations

import math
from collections.abc import Sequence

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
