"""Release-day Treasury yield reactions to macroeconomic first-print surprises."""

from __future__ import annotations

import json
import math
import sys
from bisect import bisect_left
from collections.abc import Iterable, Mapping, Sequence
from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl

from macro_event_lab.arena.metrics import student_t_cdf
from macro_event_lab.arena.targets import TARGETS, first_print_targets

SCHEMA_VERSION = 1
MODEL_BENCHMARK_CONTESTANTS = ("ar", "ridge", "factor_ridge", "lasso")
MIN_SUMMARY_ROWS = 10
YIELD_SERIES = ("DGS2", "DGS10")


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value)
    return None


def _finite_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) else None


def _round4(value: float) -> float:
    rounded = round(float(value), 4)
    return 0.0 if rounded == 0.0 else rounded


def _as_rows(data: pl.DataFrame | Iterable[Mapping[str, Any]]) -> list[Mapping[str, Any]]:
    if isinstance(data, pl.DataFrame):
        return list(data.iter_rows(named=True))
    return list(data)


def _pearson_corr(xs: Sequence[float], ys: Sequence[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 1e-15 or syy <= 1e-15:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    corr = sxy / math.sqrt(sxx * syy)
    return max(-1.0, min(1.0, corr))


def _ols_slope_and_p(
    xs: Sequence[float], ys: Sequence[float],
) -> tuple[float | None, float | None]:
    n = len(xs)
    if n < 3:
        return None, None
    mx = sum(xs) / n
    my = sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 1e-15:
        return None, None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys, strict=True))
    slope = sxy / sxx
    intercept = my - slope * mx
    ssr = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, ys, strict=True))
    se_sq = (ssr / (n - 2)) / sxx
    if se_sq <= 1e-30:
        if abs(slope) <= 1e-15:
            return 0.0, 1.0
        return slope, 0.0
    t_stat = abs(slope) / math.sqrt(se_sq)
    p_value = 2.0 * (1.0 - student_t_cdf(t_stat, n - 2))
    return slope, max(0.0, min(1.0, p_value))


def _benchmark_for(target: str, values: Mapping[str, Any]) -> tuple[float, str] | None:
    if target == "gdp":
        spf_val = _finite_float(values.get("spf"))
        if spf_val is not None:
            return spf_val, "survey"
    model_vals = [
        val
        for name in MODEL_BENCHMARK_CONTESTANTS
        if (val := _finite_float(values.get(name))) is not None
    ]
    if len(model_vals) < 2:
        return None
    return sum(model_vals) / len(model_vals), "models"


def build_reactions(
    first_prints: pl.DataFrame | Iterable[Mapping[str, Any]],
    arena_forecasts: Iterable[Mapping[str, Any]],
    yields: pl.DataFrame | Iterable[Mapping[str, Any]],
    units: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    """Pair first-print surprises against release-day 2-year and 10-year yield moves."""
    forecast_map: dict[tuple[str, date], Mapping[str, Any]] = {}
    for entry in arena_forecasts:
        target = entry.get("target")
        period = _parse_date(entry.get("period"))
        values = entry.get("values")
        if isinstance(target, str) and period is not None and isinstance(values, Mapping):
            forecast_map[(target, period)] = values

    closes: dict[str, dict[date, float]] = {series: {} for series in YIELD_SERIES}
    for yrow in _as_rows(yields):
        series = yrow.get("series")
        obs_date = _parse_date(yrow.get("date"))
        val = _finite_float(yrow.get("value"))
        if series in closes and obs_date is not None and val is not None:
            closes[str(series)][obs_date] = val
    sorted_dates = {series: sorted(series_map) for series, series_map in closes.items()}

    def yield_change_bp(series: str, release_date: date) -> float | None:
        series_map = closes[series]
        on_day = series_map.get(release_date)
        if on_day is None:
            return None
        dates_list = sorted_dates[series]
        prev_idx = bisect_left(dates_list, release_date) - 1
        if prev_idx < 0:
            return None
        prev_val = series_map[dates_list[prev_idx]]
        return (on_day - prev_val) * 100.0

    rows: list[dict[str, Any]] = []
    raw_by_target: dict[str, list[tuple[float, float, float]]] = {}
    seen_keys: set[tuple[str, date]] = set()

    for frow in _as_rows(first_prints):
        target = frow.get("target")
        ref_raw = (
            frow["reference_period"] if "reference_period" in frow else frow.get("period")
        )
        ref_period = _parse_date(ref_raw)
        rel_date = _parse_date(frow.get("release_date"))
        first_print = _finite_float(frow.get("first_print"))
        if (
            not isinstance(target, str)
            or ref_period is None
            or rel_date is None
            or first_print is None
        ):
            continue
        key = (target, ref_period)
        if key in seen_keys:
            continue
        values = forecast_map.get(key)
        if values is None:
            continue
        bench = _benchmark_for(target, values)
        if bench is None:
            continue
        d2y = yield_change_bp("DGS2", rel_date)
        d10y = yield_change_bp("DGS10", rel_date)
        if d2y is None or d10y is None:
            continue

        seen_keys.add(key)
        benchmark, benchmark_kind = bench
        surprise = first_print - benchmark
        raw_by_target.setdefault(target, []).append((surprise, d2y, d10y))
        rows.append(
            {
                "target": target,
                "period": ref_period.isoformat(),
                "release_date": rel_date.isoformat(),
                "first_print": _round4(first_print),
                "benchmark": _round4(benchmark),
                "benchmark_kind": benchmark_kind,
                "surprise": _round4(surprise),
                "d2y_bp": _round4(d2y),
                "d10y_bp": _round4(d10y),
            }
        )

    rows.sort(key=lambda r: (str(r["target"]), str(r["period"])))

    target_order = list(TARGETS)
    for target in sorted(raw_by_target):
        if target not in target_order:
            target_order.append(target)

    summary: list[dict[str, Any]] = []
    for target in target_order:
        pts = raw_by_target.get(target, [])
        n = len(pts)
        if n < MIN_SUMMARY_ROWS:
            summary.append(
                {
                    "target": target,
                    "n": n,
                    "corr_2y": None,
                    "corr_10y": None,
                    "slope_10y_bp_per_unit": None,
                    "p_10y": None,
                }
            )
            continue
        xs = [p[0] for p in pts]
        y2s = [p[1] for p in pts]
        y10s = [p[2] for p in pts]
        corr_2y = _pearson_corr(xs, y2s)
        corr_10y = _pearson_corr(xs, y10s)
        slope_10y, p_10y = _ols_slope_and_p(xs, y10s)
        summary.append(
            {
                "target": target,
                "n": n,
                "corr_2y": None if corr_2y is None else _round4(corr_2y),
                "corr_10y": None if corr_10y is None else _round4(corr_10y),
                "slope_10y_bp_per_unit": None if slope_10y is None else _round4(slope_10y),
                "p_10y": None if p_10y is None else _round4(p_10y),
            }
        )

    default_units = {key: spec[2] for key, spec in TARGETS.items()}
    resolved_units = {
        key: str(units[key]) if units and key in units else default_units[key]
        for key in TARGETS
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "rows": rows,
        "summary": summary,
        "units": resolved_units,
    }


def _load_yield_rows(data_dir: Path, observations: pl.DataFrame | None) -> list[dict[str, Any]]:
    yields_path = data_dir / "silver" / "yields.parquet"
    if yields_path.exists():
        frame = pl.read_parquet(yields_path)
        date_col = "date" if "date" in frame.columns else "observation_date"
        series_col = "series" if "series" in frame.columns else "series_id"
        if {date_col, series_col, "value"} <= set(frame.columns):
            rows = (
                frame.filter(
                    pl.col(series_col).is_in(list(YIELD_SERIES)) & pl.col("value").is_not_null()
                )
                .select(
                    pl.col(date_col).alias("date"),
                    pl.col(series_col).alias("series"),
                    pl.col("value"),
                )
                .to_dicts()
            )
            if rows:
                return rows
    if observations is None:
        return []
    filtered = observations.filter(
        pl.col("series_id").is_in(list(YIELD_SERIES)) & pl.col("value").is_not_null()
    )
    if "realtime_end" in filtered.columns:
        filtered = filtered.filter(pl.col("realtime_end").is_null())
    return filtered.select(
        pl.col("observation_date").alias("date"),
        pl.col("series_id").alias("series"),
        pl.col("value"),
    ).to_dicts()


def write_reactions(data_dir: Path, out_path: Path) -> int:
    """Build reactions JSON from silver tables and web_public/arena.json, or exit 1."""
    alfred_path = data_dir / "silver" / "alfred_observations.parquet"
    arena_path = data_dir / "web_public" / "arena.json"
    if not alfred_path.exists():
        print(f"Missing ALFRED silver table at {alfred_path}", file=sys.stderr)
        raise SystemExit(1)

    observations = pl.read_parquet(alfred_path)
    yield_rows = _load_yield_rows(data_dir, observations)
    series_present = {str(r["series"]) for r in yield_rows}
    if not yield_rows or not set(YIELD_SERIES).issubset(series_present):
        print(f"Missing DGS2 or DGS10 yield data in {data_dir / 'silver'}", file=sys.stderr)
        raise SystemExit(1)

    if not arena_path.exists():
        print(f"Missing arena file at {arena_path}", file=sys.stderr)
        raise SystemExit(1)

    arena = json.loads(arena_path.read_text(encoding="utf-8"))
    first_print_rows = (
        first_print_targets(observations)
        .rename({"period": "reference_period"})
        .to_dicts()
    )
    arena_units = {
        str(entry["id"]): str(entry["unit"])
        for entry in arena.get("targets", [])
        if isinstance(entry, Mapping) and "id" in entry and "unit" in entry
    }
    payload = build_reactions(
        first_print_rows,
        arena.get("forecasts", []),
        yield_rows,
        units=arena_units or None,
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    n_rows = len(payload["rows"])
    print(f"Wrote {out_path}: {n_rows} rows")
    return n_rows
