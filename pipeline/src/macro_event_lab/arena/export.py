"""Builds arena.json, the public file of the forecast arena, from the silver tables."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import polars as pl

from macro_event_lab.arena import conformal, contestants, metrics
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
NESTED_PAIRS = (("naive", "ar"), ("ar", "ridge"))


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
        ordered = group.sort("period")
        errors = [r["actual"] - r["value"] for r in ordered.iter_rows(named=True)]
        covered = ordered.drop_nulls(["lo", "hi"])
        n_intervals = covered.height
        if n_intervals > 0:
            cov_actuals = covered["actual"].to_list()
            cov_los = covered["lo"].to_list()
            cov_vals = covered["value"].to_list()
            cov_his = covered["hi"].to_list()
            hits = sum(
                metrics.inside(y, lo, hi)
                for y, lo, hi in zip(cov_actuals, cov_los, cov_his, strict=True)
            )
            cov_lo, cov_hi = metrics.wilson_interval(hits, n_intervals)
            pinball_05 = metrics.pinball_loss(cov_actuals, cov_los, 0.05)
            pinball_50 = metrics.pinball_loss(cov_actuals, cov_vals, 0.5)
            pinball_95 = metrics.pinball_loss(cov_actuals, cov_his, 0.95)
            cov_90 = metrics.coverage(cov_actuals, cov_los, cov_his)
        else:
            cov_lo, cov_hi = None, None
            pinball_05, pinball_50, pinball_95 = None, None, None
            cov_90 = None
        aci = conformal.aci_coverage(errors)
        aci_cov = aci["coverage"]
        p_value = None
        if name != "naive":
            pairs = [
                ((r["actual"] - r["value"]) ** 2, naive_loss[(target, r["period"])])
                for r in ordered.iter_rows(named=True)
                if (target, r["period"]) in naive_loss
            ]
            test = metrics.dm_test([a for a, _ in pairs], [b for _, b in pairs]) if pairs else None
            p_value = None if test is None else test["p_value"]
        for window in ("all", "clean"):
            rows.append({
                "target": target,
                "contestant": name,
                "window": window,
                "n": len(errors),
                "mae": _round(metrics.mae(errors)),
                "rmse": _round(metrics.rmse(errors)),
                "coverage_90": _round(cov_90),
                "dm_vs_naive_p": _round(p_value),
                "n_intervals": n_intervals,
                "coverage_90_lo": _round(cov_lo),
                "coverage_90_hi": _round(cov_hi),
                "pinball_05": _round(pinball_05),
                "pinball_50": _round(pinball_50),
                "pinball_95": _round(pinball_95),
                "aci_n": aci["n"],
                "aci_coverage_90": _round(None if aci_cov is None else float(aci_cov)),
            })
    return sorted(
        rows,
        key=lambda r: (str(r["target"]), ORDER.index(str(r["contestant"])), str(r["window"])),
    )


def _nested_tests(forecasts: pl.DataFrame) -> list[dict[str, object]]:
    """Clark and West nested model tests per target, pair and window."""
    if forecasts.is_empty():
        return []
    rows: list[dict[str, object]] = []
    by_target_contestant: dict[tuple[str, str], dict[date, tuple[float, float]]] = {}
    for row in forecasts.sort("period").iter_rows(named=True):
        by_target_contestant.setdefault(
            (str(row["target"]), str(row["contestant"])), {},
        )[row["period"]] = (float(row["value"]), float(row["actual"]))

    for target in sorted({str(t) for t in forecasts["target"].to_list()}):
        for restricted, larger in NESTED_PAIRS:
            r_map = by_target_contestant.get((target, restricted))
            l_map = by_target_contestant.get((target, larger))
            if not r_map or not l_map:
                continue
            common_periods = sorted(set(r_map) & set(l_map))
            if not common_periods:
                continue
            r_forecasts = [r_map[p][0] for p in common_periods]
            l_forecasts = [l_map[p][0] for p in common_periods]
            actuals = [r_map[p][1] for p in common_periods]
            test = metrics.clark_west_test(r_forecasts, l_forecasts, actuals)
            if test is None:
                continue
            for window in ("all", "clean"):
                rows.append({
                    "target": target,
                    "restricted": restricted,
                    "larger": larger,
                    "window": window,
                    "n": test["n"],
                    "statistic": _round(float(test["statistic"])),
                    "p_value": _round(float(test["p_value"])),
                })
    return rows


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
        "nested_tests": _nested_tests(forecasts),
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
