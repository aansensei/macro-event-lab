"""Flatten public arena and revisions JSON exports into downloadable Parquet and CSV tables."""

from __future__ import annotations

import csv
import io
import json
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import polars as pl

FORECAST_HEADER = [
    "target",
    "period",
    "made_on",
    "contestant_id",
    "contestant",
    "kind",
    "forecast",
    "first_print",
    "interval_lo",
    "interval_hi",
    "error",
]
SCORE_HEADER = [
    "target",
    "contestant_id",
    "contestant",
    "window",
    "n",
    "mae",
    "rmse",
    "coverage_90",
    "dm_vs_naive_p",
    "n_intervals",
    "coverage_90_lo",
    "coverage_90_hi",
    "pinball_05",
    "pinball_50",
    "pinball_95",
    "aci_n",
    "aci_coverage_90",
    "crps",
    "crps_n",
]
REVISIONS_HEADER = [
    "series",
    "label",
    "unit",
    "period",
    "first_print",
    "next_print",
    "latest",
    "settled",
]

FORECAST_SCHEMA: dict[str, pl.DataType] = {
    "target": pl.String,
    "period": pl.Date,
    "made_on": pl.Date,
    "contestant_id": pl.String,
    "contestant": pl.String,
    "kind": pl.String,
    "forecast": pl.Float64,
    "first_print": pl.Float64,
    "interval_lo": pl.Float64,
    "interval_hi": pl.Float64,
    "error": pl.Float64,
}
SCORE_SCHEMA: dict[str, pl.DataType] = {
    "target": pl.String,
    "contestant_id": pl.String,
    "contestant": pl.String,
    "window": pl.String,
    "n": pl.Int64,
    "mae": pl.Float64,
    "rmse": pl.Float64,
    "coverage_90": pl.Float64,
    "dm_vs_naive_p": pl.Float64,
    "n_intervals": pl.Int64,
    "coverage_90_lo": pl.Float64,
    "coverage_90_hi": pl.Float64,
    "pinball_05": pl.Float64,
    "pinball_50": pl.Float64,
    "pinball_95": pl.Float64,
    "aci_n": pl.Int64,
    "aci_coverage_90": pl.Float64,
    "crps": pl.Float64,
    "crps_n": pl.Int64,
}
REVISIONS_SCHEMA: dict[str, pl.DataType] = {
    "series": pl.String,
    "label": pl.String,
    "unit": pl.String,
    "period": pl.Date,
    "first_print": pl.Float64,
    "next_print": pl.Float64,
    "latest": pl.Float64,
    "settled": pl.Boolean,
}


def _format_number(value: int | float | None) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return repr(value)
    text = repr(value)
    if "e" in text or "E" in text:
        dec = Decimal(text)
        exponent = dec.as_tuple().exponent
        if isinstance(exponent, int) and -6 <= exponent < 0 and abs(value) < 1:
            return format(dec, "f")
    return text


def _to_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _to_int(value: Any) -> int | None:
    return None if value is None else int(value)


def _render_csv(header: list[str], rows: list[list[str]]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def _arena_forecast_records(arena: dict[str, Any]) -> list[tuple[Any, ...]]:
    contestants = arena.get("contestants", [])
    records: list[tuple[Any, ...]] = []
    for entry in arena.get("forecasts", []):
        values = entry.get("values") or {}
        intervals = entry.get("intervals") or {}
        actual = entry.get("actual")
        for contestant in contestants:
            cid = contestant["id"]
            if cid not in values:
                continue
            forecast = values[cid]
            band = intervals.get(cid) or {}
            error = None if forecast is None or actual is None else round(actual - forecast, 4)
            records.append((
                str(entry["target"]),
                str(entry["period"]),
                str(entry["made_on"]),
                str(cid),
                str(contestant["label"]),
                str(contestant["kind"]),
                forecast,
                actual,
                band.get("lo"),
                band.get("hi"),
                error,
            ))
    return records


def _arena_score_records(arena: dict[str, Any]) -> list[tuple[Any, ...]]:
    labels = {str(c["id"]): str(c["label"]) for c in arena.get("contestants", [])}
    records: list[tuple[Any, ...]] = []
    for score in arena.get("scores", []):
        cid = str(score["contestant"])
        records.append((
            str(score["target"]),
            cid,
            labels.get(cid, cid),
            str(score["window"]),
            score.get("n"),
            score.get("mae"),
            score.get("rmse"),
            score.get("coverage_90"),
            score.get("dm_vs_naive_p"),
            score.get("n_intervals"),
            score.get("coverage_90_lo"),
            score.get("coverage_90_hi"),
            score.get("pinball_05"),
            score.get("pinball_50"),
            score.get("pinball_95"),
            score.get("aci_n"),
            score.get("aci_coverage_90"),
            score.get("crps"),
            score.get("crps_n"),
        ))
    return records


def _revisions_records(revisions: dict[str, Any]) -> list[tuple[Any, ...]]:
    records: list[tuple[Any, ...]] = []
    for series in revisions.get("series", []):
        for point in series.get("points", []):
            records.append((
                str(series["series"]),
                str(series["label"]),
                str(series["unit"]),
                str(point["period"]),
                point.get("first"),
                point.get("next"),
                point.get("latest"),
                bool(point["settled"]),
            ))
    return records


def arena_forecasts_csv(arena: dict[str, Any]) -> str:
    """Flatten arena forecast entries into CSV text in contestant order."""
    rows = [
        [
            r[0], r[1], r[2], r[3], r[4], r[5],
            _format_number(r[6]),
            _format_number(r[7]),
            _format_number(r[8]),
            _format_number(r[9]),
            _format_number(r[10]),
        ]
        for r in _arena_forecast_records(arena)
    ]
    return _render_csv(FORECAST_HEADER, rows)


def arena_scores_csv(arena: dict[str, Any]) -> str:
    """Flatten arena score entries into CSV text in file order."""
    rows = [
        [r[0], r[1], r[2], r[3], *(_format_number(value) for value in r[4:])]
        for r in _arena_score_records(arena)
    ]
    return _render_csv(SCORE_HEADER, rows)


def revisions_csv(revisions: dict[str, Any]) -> str:
    """Flatten revisions series points into CSV text in file order."""
    rows = [
        [
            r[0], r[1], r[2], r[3],
            _format_number(r[4]),
            _format_number(r[5]),
            _format_number(r[6]),
            "true" if r[7] else "false",
        ]
        for r in _revisions_records(revisions)
    ]
    return _render_csv(REVISIONS_HEADER, rows)


def write_open_data_parquet(out_dir: Path) -> tuple[Path, Path, Path]:
    """Read arena.json and revisions.json in out_dir and write three zstd Parquet files."""
    out = Path(out_dir)
    arena = json.loads((out / "arena.json").read_text(encoding="utf-8"))
    revisions = json.loads((out / "revisions.json").read_text(encoding="utf-8"))

    forecast_rows = [
        (
            r[0],
            date.fromisoformat(r[1]),
            date.fromisoformat(r[2]),
            r[3],
            r[4],
            r[5],
            _to_float(r[6]),
            _to_float(r[7]),
            _to_float(r[8]),
            _to_float(r[9]),
            _to_float(r[10]),
        )
        for r in _arena_forecast_records(arena)
    ]
    score_rows = [
        (
            r[0],
            r[1],
            r[2],
            r[3],
            _to_int(r[4]),
            _to_float(r[5]),
            _to_float(r[6]),
            _to_float(r[7]),
            _to_float(r[8]),
            _to_int(r[9]),
            _to_float(r[10]),
            _to_float(r[11]),
            _to_float(r[12]),
            _to_float(r[13]),
            _to_float(r[14]),
            _to_int(r[15]),
            _to_float(r[16]),
            _to_float(r[17]),
            _to_int(r[18]),
        )
        for r in _arena_score_records(arena)
    ]
    revision_rows = [
        (
            r[0],
            r[1],
            r[2],
            date.fromisoformat(r[3]),
            _to_float(r[4]),
            _to_float(r[5]),
            _to_float(r[6]),
            bool(r[7]),
        )
        for r in _revisions_records(revisions)
    ]

    forecasts_path = out / "arena_forecasts.parquet"
    scores_path = out / "arena_scores.parquet"
    revisions_path = out / "revisions.parquet"

    pl.DataFrame(forecast_rows, schema=FORECAST_SCHEMA, orient="row").write_parquet(
        forecasts_path, compression="zstd",
    )
    pl.DataFrame(score_rows, schema=SCORE_SCHEMA, orient="row").write_parquet(
        scores_path, compression="zstd",
    )
    pl.DataFrame(revision_rows, schema=REVISIONS_SCHEMA, orient="row").write_parquet(
        revisions_path, compression="zstd",
    )
    return forecasts_path, scores_path, revisions_path


def write_open_data(out_dir: Path) -> tuple[Path, Path, Path]:
    """Read arena.json and revisions.json in out_dir and write Parquet and CSV files."""
    out = Path(out_dir)
    arena = json.loads((out / "arena.json").read_text(encoding="utf-8"))
    revisions = json.loads((out / "revisions.json").read_text(encoding="utf-8"))
    targets = (
        (out / "arena_forecasts.csv", arena_forecasts_csv(arena)),
        (out / "arena_scores.csv", arena_scores_csv(arena)),
        (out / "revisions.csv", revisions_csv(revisions)),
    )
    for path, content in targets:
        path.write_text(content, encoding="utf-8", newline="\n")
    write_open_data_parquet(out)
    return targets[0][0], targets[1][0], targets[2][0]
