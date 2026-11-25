"""Builds arena.json, the public file of the forecast arena, from the silver tables."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import polars as pl

from macro_event_lab.arena import contestants, metrics
from macro_event_lab.arena.harness import (
    origin_forecasts,
    run_walk_forward,
    target_features,
    training_panel,
)
from macro_event_lab.arena.targets import (
    ORIGIN_SCHEMA,
    TARGETS,
    add_months,
    build_origins,
    data_as_of,
    first_print_targets,
)
from macro_event_lab.config import Paths

SCHEMA_VERSION = 1
LEVEL = 0.9
DIGITS = 4
ORDER = ("naive", "ar", "ridge", "factor_ridge", "lasso", "spf")


def _round(value: float | None) -> float | None:
    return None if value is None else round(float(value), DIGITS)


def _scores(forecasts: pl.DataFrame) -> list[dict[str, object]]:
    """Scores per target and contestant; no contestant here has a training cutoff, so the
    clean window equals the full window."""
    rows: list[dict[str, object]] = []
    naive_loss = {
        (r["target"], r["period"]): (r["actual"] - r["value"]) ** 2
        for r in forecasts.filter(pl.col("contestant") == "naive").iter_rows(named=True)
    }
    for (target, name), group in forecasts.group_by(["target", "contestant"], maintain_order=True):
        errors = [r["actual"] - r["value"] for r in group.iter_rows(named=True)]
        covered = group.drop_nulls(["lo", "hi"])
        p_value = None
        if name != "naive":
            pairs = [
                ((r["actual"] - r["value"]) ** 2, naive_loss[(target, r["period"])])
                for r in group.sort("period").iter_rows(named=True)
                if (target, r["period"]) in naive_loss
            ]
            test = metrics.dm_test([a for a, _ in pairs], [b for _, b in pairs]) if pairs else None
            p_value = None if test is None else test["p_value"]
        for window in ("all", "clean"):
            rows.append({
                "target": target, "contestant": name, "window": window, "n": len(errors),
                "mae": _round(metrics.mae(errors)), "rmse": _round(metrics.rmse(errors)),
                "coverage_90": _round(metrics.coverage(
                    covered["actual"].to_list(), covered["lo"].to_list(), covered["hi"].to_list(),
                )),
                "dm_vs_naive_p": _round(p_value),
            })
    return sorted(
        rows,
        key=lambda r: (str(r["target"]), ORDER.index(str(r["contestant"])), str(r["window"])),
    )


def _live(
    observations: pl.DataFrame, targets: pl.DataFrame, origins: pl.DataFrame,
    survey: pl.DataFrame | None, information_date: date,
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for target, (_ticker, _label, _unit, frequency) in TARGETS.items():
        frame = targets.filter(pl.col("target") == target)
        if frame.is_empty():
            continue
        released = data_as_of(frame, information_date)
        latest_period = (released if not released.is_empty() else frame)["period"].max()
        step = 3 if frequency == "quarterly" else 1
        period = add_months(latest_period, step)
        _hist, train_x, train_y, train_release, train_made_on = training_panel(
            observations, targets, origins, target,
        )
        live_origin = pl.DataFrame(
            [{"target": target, "period": period, "made_on": information_date}],
            schema=ORIGIN_SCHEMA, orient="row",
        )
        x_now = target_features(observations, targets, live_origin, target).get(period)
        raw = origin_forecasts(
            target, frame, survey, train_x, train_y, train_release, train_made_on,
            x_now, period, information_date,
        )
        values = {name: _round(raw[name]) for name in ORDER if raw.get(name) is not None}
        if values:
            rows.append({
                "target": target, "period": period.isoformat(),
                "as_of": information_date.isoformat(), "values": values,
            })
    return rows


def build_arena(
    observations: pl.DataFrame, survey: pl.DataFrame | None, information_date: date,
) -> dict[str, object]:
    targets = first_print_targets(observations)
    origins = build_origins(targets, survey)
    forecasts = run_walk_forward(observations, survey, targets, origins)
    present = [name for name in ORDER if name in set(forecasts["contestant"])]
    by_period: dict[tuple[str, date], dict[str, object]] = {}
    for row in forecasts.iter_rows(named=True):
        key = (row["target"], row["period"])
        entry = by_period.setdefault(key, {
            "target": row["target"], "period": row["period"].isoformat(),
            "made_on": row["made_on"].isoformat(), "actual": _round(row["actual"]),
            "values": {}, "intervals": {},
        })
        entry["values"][row["contestant"]] = _round(row["value"])
        if row["lo"] is not None and row["hi"] is not None:
            entry["intervals"][row["contestant"]] = {
                "level": LEVEL, "lo": _round(row["lo"]), "hi": _round(row["hi"]),
            }
    return {
        "schema_version": SCHEMA_VERSION,
        "information_date": information_date.isoformat(),
        "targets": [
            {"id": key, "label": label, "unit": unit, "frequency": frequency}
            for key, (_ticker, label, unit, frequency) in TARGETS.items()
        ],
        "contestants": [
            {"id": name, "label": contestants.LABELS[name], "kind": contestants.KINDS[name],
             "note": contestants.NOTES[name]}
            for name in present
        ],
        "forecasts": [by_period[key] for key in sorted(by_period)],
        "scores": _scores(forecasts),
        "leakage": [],
        "live": _live(observations, targets, origins, survey, information_date),
    }


def write_arena(paths: Paths, information_date: date, out_dir: Path | None = None) -> Path:
    observations = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    survey_path = paths.silver / "spf_forecasts.parquet"
    survey = pl.read_parquet(survey_path) if survey_path.exists() else None
    payload = build_arena(observations, survey, information_date)
    target_dir = out_dir or paths.root / "web_public"
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / "arena.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path
