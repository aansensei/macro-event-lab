"""Flatten public arena and revisions JSON exports into downloadable CSV tables."""

from __future__ import annotations

import csv
import io
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

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


def _render_csv(header: list[str], rows: list[list[str]]) -> str:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(header)
    writer.writerows(rows)
    return buffer.getvalue()


def arena_forecasts_csv(arena: dict[str, Any]) -> str:
    """Flatten arena forecast entries into CSV text in contestant order."""
    contestants = arena.get("contestants", [])
    rows: list[list[str]] = []
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
            rows.append([
                str(entry["target"]),
                str(entry["period"]),
                str(entry["made_on"]),
                str(cid),
                str(contestant["label"]),
                str(contestant["kind"]),
                _format_number(forecast),
                _format_number(actual),
                _format_number(band.get("lo")),
                _format_number(band.get("hi")),
                _format_number(error),
            ])
    return _render_csv(FORECAST_HEADER, rows)


def arena_scores_csv(arena: dict[str, Any]) -> str:
    """Flatten arena score entries into CSV text in file order."""
    labels = {str(c["id"]): str(c["label"]) for c in arena.get("contestants", [])}
    rows: list[list[str]] = []
    for score in arena.get("scores", []):
        cid = str(score["contestant"])
        rows.append([
            str(score["target"]),
            cid,
            labels.get(cid, cid),
            str(score["window"]),
            _format_number(score.get("n")),
            _format_number(score.get("mae")),
            _format_number(score.get("rmse")),
            _format_number(score.get("coverage_90")),
            _format_number(score.get("dm_vs_naive_p")),
        ])
    return _render_csv(SCORE_HEADER, rows)


def revisions_csv(revisions: dict[str, Any]) -> str:
    """Flatten revisions series points into CSV text in file order."""
    rows: list[list[str]] = []
    for series in revisions.get("series", []):
        for point in series.get("points", []):
            rows.append([
                str(series["series"]),
                str(series["label"]),
                str(series["unit"]),
                str(point["period"]),
                _format_number(point.get("first")),
                _format_number(point.get("next")),
                _format_number(point.get("latest")),
                "true" if point["settled"] else "false",
            ])
    return _render_csv(REVISIONS_HEADER, rows)


def write_open_data(out_dir: Path) -> tuple[Path, Path, Path]:
    """Read arena.json and revisions.json in out_dir and write the three CSV files."""
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
    return targets[0][0], targets[1][0], targets[2][0]
