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
        if target == "gdp":
            features = contestants.gdp_features(observations, target_origins)
        else:
            features = contestants.monthly_features(observations, targets, target_origins, target)

        target_rows = [
            (r["period"], r["made_on"]) for r in target_origins.iter_rows(named=True)
            if r["period"] in truth and r["period"] in features
        ]
        train_x = [features[period] for period, _ in target_rows]
        train_y = [truth[period]["first_print"] for period, _ in target_rows]
        train_release = [truth[period]["release_date"] for period, _ in target_rows]
        train_made_on = [made_on for _, made_on in target_rows]

        for origin in target_origins.iter_rows(named=True):
            period, made_on = origin["period"], origin["made_on"]
            if period not in truth:
                continue
            known = data_as_of(frame, made_on).sort("period")["first_print"].to_list()
            forecasts = {
                "naive": contestants.naive_forecast(known),
                "ar": contestants.ar_forecast(known),
            }
            if target == "gdp" and survey is not None:
                forecasts["spf"] = contestants.spf_forecast(survey, period, made_on)
            if period in features and train_x:
                for name, forecast in (
                    ("ridge", contestants.ridge_forecast),
                    ("factor_ridge", contestants.factor_ridge_forecast),
                    ("lasso", contestants.lasso_forecast),
                ):
                    forecasts[name] = forecast(
                        np.vstack(train_x), train_y, train_release, train_made_on,
                        features[period], made_on,
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
