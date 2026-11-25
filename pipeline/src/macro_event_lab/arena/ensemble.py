"""Combine expert forecasts using only errors published by the forecast origin."""

from __future__ import annotations

import math
from datetime import date

import polars as pl

EXPERTS = ("naive", "ar", "ridge", "factor_ridge", "lasso")
WINDOW = 40
MIN_HISTORY = 12


def ensemble_weights(
    history: pl.DataFrame,
    target: str,
    period: date,
    made_on: date,
    values: dict[str, float | None],
) -> dict[str, float]:
    """Normalize clipped exponential losses over each expert's recent public errors."""
    public = history.filter(
        (pl.col("target") == target)
        & (pl.col("period") < period)
        & (pl.col("release_date") <= made_on)
    ).sort("period")
    candidates = (*EXPERTS, "spf") if target == "gdp" else EXPERTS
    errors = {
        name: [
            float(r["actual"] - r["value"])
            for r in public.filter(
                pl.col("contestant") == name,
            )
            .tail(WINDOW)
            .iter_rows(named=True)
        ]
        for name in candidates
    }
    eligible = [
        name
        for name in candidates
        if values.get(name) is not None and len(errors[name]) >= MIN_HISTORY
    ]
    if len(eligible) < 2:
        return {}
    baseline = errors["naive"]
    s2 = sum(e * e for e in baseline) / len(baseline) if baseline else 0.0
    if len(baseline) < MIN_HISTORY or s2 == 0:
        return dict.fromkeys(eligible, 1.0 / len(eligible))
    eta = math.sqrt(8 * math.log(len(eligible)) / WINDOW)
    weights = {
        name: math.exp(-eta * sum(min(1.0, e * e / (9 * s2)) for e in errors[name]))
        for name in eligible
    }
    total = sum(weights.values())
    return {name: weight / total for name, weight in weights.items()}


def ensemble_forecast(
    history: pl.DataFrame,
    target: str,
    period: date,
    made_on: date,
    values: dict[str, float | None],
) -> float | None:
    weights = ensemble_weights(history, target, period, made_on, values)
    return (
        sum(weight * float(values[name]) for name, weight in weights.items()) if weights else None
    )


def add_ensemble(forecasts: pl.DataFrame) -> pl.DataFrame:
    """Append one ensemble row per eligible origin before conformal intervals are fitted."""
    rows = []
    for (target, period), group in forecasts.group_by(["target", "period"], maintain_order=True):
        origin = group.row(0, named=True)
        values = {r["contestant"]: r["value"] for r in group.iter_rows(named=True)}
        value = ensemble_forecast(forecasts, target, period, origin["made_on"], values)
        if value is not None:
            rows.append(
                {**origin, "contestant": "ensemble", "value": value, "lo": None, "hi": None}
            )
    if not rows:
        return forecasts
    return pl.concat([forecasts, pl.DataFrame(rows, schema=forecasts.schema)]).sort(
        "target",
        "period",
        "contestant",
    )
