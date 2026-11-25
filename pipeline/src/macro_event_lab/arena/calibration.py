"""Observed coverage of conformal intervals at several levels and predictive quantiles."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

import polars as pl

from macro_event_lab.arena import conformal, metrics

LEVELS = (0.5, 0.8, 0.9)
PROBS = tuple(round(0.05 * step, 2) for step in range(1, 20))


def _public_residuals(ordered: list[dict[str, object]], index: int) -> list[float]:
    """Errors of earlier periods whose actual was public when row `index` was forecast."""
    row = ordered[index]
    return [
        float(earlier["actual"]) - float(earlier["value"])  # type: ignore[arg-type]
        for earlier in ordered[:index]
        if earlier["release_date"] <= row["made_on"]  # type: ignore[operator]
    ]


def calibration_rows(
    forecasts: pl.DataFrame, levels: Sequence[float] = LEVELS,
) -> list[dict[str, object]]:
    """Per target, contestant and level: how often the actual fell inside that interval.

    Each interval is built like the published one, from the last 40 errors known at the
    origin, so only periods with enough history count. Sorted by target, contestant, level.
    """
    rows: list[dict[str, object]] = []
    grouped = forecasts.group_by(["target", "contestant"], maintain_order=True)
    for (target, contestant), group in grouped:
        ordered = group.sort("period").to_dicts()
        counts = {level: [0, 0] for level in levels}
        for index, row in enumerate(ordered):
            residuals = _public_residuals(ordered, index)
            for level in levels:
                half = conformal.conformal_half_width(residuals, level)
                if half is None:
                    continue
                counts[level][1] += 1
                low_edge, high_edge = row["value"] - half, row["value"] + half
                counts[level][0] += metrics.inside(row["actual"], low_edge, high_edge)
        for level in levels:
            hits, n = counts[level]
            if n == 0:
                continue
            low, high = metrics.wilson_interval(hits, n)
            rows.append({
                "target": target, "contestant": contestant, "level": level, "n": n,
                "coverage": hits / n, "coverage_lo": low, "coverage_hi": high,
            })
    return sorted(
        rows, key=lambda r: (str(r["target"]), str(r["contestant"]), float(r["level"])),  # type: ignore[arg-type]
    )


def predictive_quantiles(
    point: float, residuals: Sequence[float], probs: Sequence[float] = PROBS,
    window: int = conformal.WINDOW,
) -> list[float] | None:
    """Quantiles of the point forecast plus the last `window` errors, None with too little history.

    The quantile of probability p sits at position (n - 1) * p of the sorted errors, with
    linear interpolation between the two neighbours.
    """
    recent = sorted(residuals[-window:])
    if len(recent) < window:
        return None
    out: list[float] = []
    for p in probs:
        position = (len(recent) - 1) * p
        lower = int(position)
        upper = min(lower + 1, len(recent) - 1)
        fraction = position - lower
        out.append(point + recent[lower] + fraction * (recent[upper] - recent[lower]))
    return out


def live_residuals(
    forecasts: pl.DataFrame, target: str, contestant: str, as_of: date,
) -> list[float]:
    """Errors of one contestant on one target whose actual was public on `as_of`, oldest first."""
    frame = forecasts.filter(
        (pl.col("target") == target) & (pl.col("contestant") == contestant)
        & (pl.col("release_date") <= as_of)
    ).sort("period")
    return [float(a) - float(v) for a, v in zip(frame["actual"], frame["value"], strict=True)]
