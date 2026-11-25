"""Walk forward runner: every contestant forecasts every origin from public information only."""

from __future__ import annotations

from datetime import date

import numpy as np
import polars as pl

from macro_event_lab.arena import conformal, contestants
from macro_event_lab.arena.targets import data_as_of

FORECAST_SCHEMA = {
    "target": pl.String, "period": pl.Date, "contestant": pl.String, "made_on": pl.Date,
    "value": pl.Float64, "actual": pl.Float64, "release_date": pl.Date,
    "lo": pl.Float64, "hi": pl.Float64,
}


PENALIZED_CONTESTANTS = (
    ("ridge", contestants.ridge_forecast),
    ("factor_ridge", contestants.factor_ridge_forecast),
    ("lasso", contestants.lasso_forecast),
)


def target_features(
    observations: pl.DataFrame, targets: pl.DataFrame, origins: pl.DataFrame, target: str,
) -> dict[date, np.ndarray]:
    """Feature vectors for `target` at every origin in `origins`."""
    if target == "gdp":
        return contestants.gdp_features(observations, origins)
    return contestants.monthly_features(observations, targets, origins, target)


def training_panel(
    observations: pl.DataFrame, targets: pl.DataFrame, origins: pl.DataFrame, target: str,
) -> tuple[dict[date, np.ndarray], np.ndarray | None, list[float], list[date], list[date]]:
    """Historical features, targets, release dates and forecast dates for `target`."""
    frame = targets.filter(pl.col("target") == target)
    truth = {r["period"]: r for r in frame.iter_rows(named=True)}
    target_origins = origins.filter(pl.col("target") == target).sort("period")
    features = target_features(observations, targets, target_origins, target)
    target_rows = [
        (r["period"], r["made_on"]) for r in target_origins.iter_rows(named=True)
        if r["period"] in truth and r["period"] in features
    ]
    train_x = [features[period] for period, _ in target_rows]
    matrix = np.vstack(train_x) if train_x else None
    return (
        features,
        matrix,
        [truth[period]["first_print"] for period, _ in target_rows],
        [truth[period]["release_date"] for period, _ in target_rows],
        [made_on for _, made_on in target_rows],
    )


def origin_forecasts(
    target: str, frame: pl.DataFrame, survey: pl.DataFrame | None,
    train_x: np.ndarray | None, train_y: list[float], train_release: list[date],
    train_made_on: list[date], x_now: np.ndarray | None, period: date, made_on: date,
) -> dict[str, float | None]:
    """Forecasts from every contestant that can produce one at `(period, made_on)`."""
    known = data_as_of(frame, made_on).sort("period")["first_print"].to_list()
    forecasts: dict[str, float | None] = {
        "naive": contestants.naive_forecast(known),
        "ar": contestants.ar_forecast(known),
    }
    if target == "gdp" and survey is not None:
        forecasts["spf"] = contestants.spf_forecast(survey, period, made_on)
    if x_now is not None and train_x is not None:
        for name, forecast in PENALIZED_CONTESTANTS:
            forecasts[name] = forecast(
                train_x, train_y, train_release, train_made_on, x_now, made_on,
            )
    return forecasts


def run_walk_forward(
    observations: pl.DataFrame, survey: pl.DataFrame | None, targets: pl.DataFrame,
    origins: pl.DataFrame,
) -> pl.DataFrame:
    """One row per (target, period, contestant) that produced a forecast, with intervals."""
    rows: list[dict[str, object]] = []
    for target in ("gdp", "cpi", "payrolls"):
        frame = targets.filter(pl.col("target") == target)
        truth = {r["period"]: r for r in frame.iter_rows(named=True)}
        target_origins = origins.filter(pl.col("target") == target).sort("period")
        features, train_x, train_y, train_release, train_made_on = training_panel(
            observations, targets, origins, target,
        )
        for origin in target_origins.iter_rows(named=True):
            period, made_on = origin["period"], origin["made_on"]
            if period not in truth:
                continue
            forecasts = origin_forecasts(
                target, frame, survey, train_x, train_y, train_release, train_made_on,
                features.get(period), period, made_on,
            )
            for name, value in forecasts.items():
                if value is None:
                    continue
                rows.append({
                    "target": target, "period": period, "contestant": name, "made_on": made_on,
                    "value": float(value), "actual": truth[period]["first_print"],
                    "release_date": truth[period]["release_date"], "lo": None, "hi": None,
                })
    forecasts_frame = pl.DataFrame(rows, schema=FORECAST_SCHEMA, orient="row")
    return add_intervals(forecasts_frame)


def add_intervals(forecasts: pl.DataFrame) -> pl.DataFrame:
    """Conformal intervals using only residuals whose actual was public at each origin."""
    out: list[dict[str, object]] = []
    grouped = forecasts.group_by(["target", "contestant"], maintain_order=True)
    for _key, group in grouped:
        ordered = group.sort("period").to_dicts()
        for i, row in enumerate(ordered):
            residuals = [
                earlier["actual"] - earlier["value"]
                for earlier in ordered[:i]
                if earlier["release_date"] <= row["made_on"]
            ]
            band = conformal.interval(row["value"], conformal.conformal_half_width(residuals))
            out.append({**row, "lo": band[0] if band else None, "hi": band[1] if band else None})
    return pl.DataFrame(out, schema=FORECAST_SCHEMA, orient="row").sort(
        "target", "period", "contestant",
    )


def latest_periods(targets: pl.DataFrame) -> dict[str, date]:
    return {
        r["target"]: r["period"] for r in targets.group_by("target").agg(pl.col("period").max())
        .iter_rows(named=True)
    }
