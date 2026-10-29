"""Prebuilt JSON for the website: a manifest plus one file per event.

The first view of the site reads these files directly, so it needs no query engine. Every
number the page draws is precomputed here: per hourly snapshot the moments, percentiles,
outcome bins and the survival curve (raw contract prices and their isotonic fit).

The output is deterministic: no build time is written (only the last snapshot time), keys
and rows are in a fixed order and floats are rounded, so rebuilding unchanged data gives
byte-identical files.
"""

from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.gold import RESOLUTION

SCHEMA_VERSION = 1
DIGITS = 6
SERIES_LABEL = {"KXCPI": "CPI", "KXPAYROLLS": "Jobs", "KXGDP": "GDP", "KXFED": "FOMC"}
UNIT = {
    "KXCPI": "% m/m",
    "KXPAYROLLS": "jobs",
    "KXGDP": "% annualized",
    "KXFED": "% upper bound",
}
STAT_COLUMNS = ["mean", "sd", "p05", "p25", "p50", "p75", "p95"]


def event_id(event_ticker: str) -> str:
    """File-safe id from the ticker, e.g. "gdp-232022-q4" for "GDP-232022 Q4"."""
    return re.sub(r"[^a-z0-9]+", "-", event_ticker.lower()).strip("-")


def event_title(series_ticker: str, reference_period: date | None, close: datetime) -> str:
    """Readable name: "CPI, September 2026", "GDP, Q3 2025", "FOMC, December 2026".

    FOMC events and events without a known period are named after the month they close in.
    """
    label = SERIES_LABEL.get(series_ticker, series_ticker)
    if series_ticker == "KXGDP" and reference_period is not None:
        return f"{label}, Q{(reference_period.month - 1) // 3 + 1} {reference_period.year}"
    when = reference_period if series_ticker != "KXFED" and reference_period else close
    return f"{label}, {when:%B %Y}"


def _num(value: float | None) -> float | None:
    return None if value is None else round(float(value), DIGITS)


def _iso(value: datetime | date | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%SZ")
    return value.isoformat()


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def event_payload(
    event: dict[str, Any], stats: pl.DataFrame, bins: pl.DataFrame, survival: pl.DataFrame
) -> dict[str, Any]:
    """Everything one event page draws. Snapshots run from T-168h to the close."""
    series = event["series_ticker"]
    snapshots = []
    by_hour_bins = bins.partition_by("hours_before_close", as_dict=True)
    by_hour_survival = survival.partition_by("hours_before_close", as_dict=True)
    for row in stats.sort("hours_before_close", descending=True).iter_rows(named=True):
        h = row["hours_before_close"]
        b = by_hour_bins.get((h,), bins.clear()).sort("bin_lower", nulls_last=False)
        s = by_hour_survival.get((h,), survival.clear()).sort("floor_strike")
        snapshots.append({
            "h": h,
            "ts": _iso(row["ts"]),
            **{k: _num(row[k]) for k in STAT_COLUMNS},
            "bins": [[_num(lo), _num(hi), _num(p)]
                     for lo, hi, p in b.select("bin_lower", "bin_upper", "prob").rows()],
            "survival": [[_num(k), _num(price), _num(fit)]
                         for k, price, fit in s.select("floor_strike", "price", "survival").rows()],
        })
    return {
        "schema_version": SCHEMA_VERSION,
        "id": event_id(event["event_ticker"]),
        "event_ticker": event["event_ticker"],
        "series": series,
        "title": event_title(series, event["reference_period"], event["close"]),
        "unit": UNIT.get(series),
        "resolution": RESOLUTION.get(series),
        "close": _iso(event["close"]),
        "release_date": _iso(event["release_date"]),
        "reference_period": _iso(event["reference_period"]),
        "first_print": _num(event["first_print"]),
        "first_print_source": event["first_print_source"],
        "match_method": event["match_method"],
        "settled_value": _num(event["settled_value"]),
        "surprise": _num(event["surprise"]),
        "surprise_sd": _num(event["surprise_sd"]),
        # yield changes on the release day in basis points; null without a release day
        "reaction": None if event.get("reaction_date") is None else {
            "date": _iso(event["reaction_date"]),
            "prev_date": _iso(event["reaction_prev_date"]),
            "dgs2_bp": _num(event["dgs2_change_bp"]),
            "dgs10_bp": _num(event["dgs10_change_bp"]),
        },
        # how this event compares with every other event of its series
        "insight": None if event.get("series_n") is None else {
            "in_50": event["in_50"],
            "in_90": event["in_90"],
            "surprise_rank_pct": _num(event["surprise_rank_pct"]),
            "series_n": event["series_n"],
            "series_hit_50": _num(event["series_hit_50"]),
            "series_hit_90": _num(event["series_hit_90"]),
            "yield_n": event["yield_n"],
            "dgs2_bp_per_sd": _num(event["dgs2_bp_per_sd"]),
            "dgs10_bp_per_sd": _num(event["dgs10_bp_per_sd"]),
            "dgs2_corr": _num(event["dgs2_corr"]),
            "dgs10_corr": _num(event["dgs10_corr"]),
        },
        # bins: [lower, upper, probability], null marks an open end;
        # survival: [strike k, raw contract price, isotonic P(X > k)]
        "snapshots": snapshots,
    }


# summary key -> gold column; counts stay integers, the rest are rounded floats
SERIES_COUNTS = {"n": "series_n", "yield_n": "yield_n"}
SERIES_RATES = {
    "hit_50": "series_hit_50", "hit_90": "series_hit_90",
    "dgs2_bp_per_sd": "dgs2_bp_per_sd", "dgs10_bp_per_sd": "dgs10_bp_per_sd",
    "dgs2_corr": "dgs2_corr", "dgs10_corr": "dgs10_corr",
}


def summary_payload(events: pl.DataFrame) -> dict[str, Any]:
    """Everything the compare page draws: one row per series and one point per scored event.

    Series rows carry the cross-event statistics of gold.event_insights plus mean_abs_sd, the
    average size of a surprise. Points are the events with a surprise, oldest first.
    """
    scored = events.filter(pl.col("surprise_sd").is_not_null()).sort("close", "event_ticker")
    series = []
    for ticker in [s for s in SERIES_LABEL if s in set(events["series_ticker"])]:
        rows = events.filter(pl.col("series_ticker") == ticker)
        first = rows.row(0, named=True)
        abs_sd = scored.filter(pl.col("series_ticker") == ticker)["surprise_sd"].abs()
        series.append({
            "series": ticker,
            "label": SERIES_LABEL[ticker],
            **{key: first[col] for key, col in SERIES_COUNTS.items()},
            **{key: _num(first[col]) for key, col in SERIES_RATES.items()},
            "mean_abs_sd": _num(abs_sd.mean()) if abs_sd.len() else None,
        })
    points = [
        {
            "id": event_id(e["event_ticker"]),
            "series": e["series_ticker"],
            "title": event_title(e["series_ticker"], e["reference_period"], e["close"]),
            "surprise_sd": _num(e["surprise_sd"]),
            "dgs2_bp": _num(e["dgs2_change_bp"]),
            "dgs10_bp": _num(e["dgs10_change_bp"]),
            "in_50": e["in_50"],
            "in_90": e["in_90"],
        }
        for e in scored.iter_rows(named=True)
    ]
    return {"schema_version": SCHEMA_VERSION, "series": series, "points": points}


def build_web(paths: Paths) -> dict[str, int]:
    """Write web/manifest.json and web/events/<id>.json for every event with snapshots."""
    events = pl.read_parquet(paths.gold / "event_surprise.parquet")
    stats = pl.read_parquet(paths.gold / "implied_stats.parquet")
    bins = pl.read_parquet(paths.gold / "implied_bins.parquet")
    survival = pl.read_parquet(paths.gold / "implied_survival.parquet")

    stats_by = stats.partition_by("event_ticker", as_dict=True)
    bins_by = bins.partition_by("event_ticker", as_dict=True)
    survival_by = survival.partition_by("event_ticker", as_dict=True)

    entries = []
    shown = []
    for event in events.sort("close", "event_ticker").iter_rows(named=True):
        key = (event["event_ticker"],)
        if key not in stats_by:
            continue
        shown.append(event["event_ticker"])
        payload = event_payload(
            event, stats_by[key], bins_by.get(key, bins.clear()),
            survival_by.get(key, survival.clear()),
        )
        _write_json(paths.web / "events" / f"{payload['id']}.json", payload)
        entries.append({
            k: payload[k]
            for k in ("id", "event_ticker", "series", "title", "unit", "close", "release_date",
                      "first_print", "surprise", "surprise_sd")
        } | {"file": f"events/{payload['id']}.json", "n_snapshots": len(payload["snapshots"])})

    last = stats["ts"].max() if stats.height else None
    _write_json(paths.web / "manifest.json", {
        "schema_version": SCHEMA_VERSION,
        "data_through": _iso(last),
        "events": entries,
    })
    _write_json(
        paths.web / "summary.json",
        summary_payload(events.filter(pl.col("event_ticker").is_in(shown))),
    )
    return {"events": len(entries)}
