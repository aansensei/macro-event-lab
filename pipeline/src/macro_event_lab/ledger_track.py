"""Score forecasts recorded before the date of their first published outcome."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from typing import Any

ORDER = ("naive", "ar", "ridge", "factor_ridge", "lasso", "ensemble", "spf")


def model_order(model: str) -> tuple[int, str]:
    return (ORDER.index(model) if model in ORDER else len(ORDER), model)


def score_ledger(
    rows: list[dict[str, Any]], first_prints: list[dict[str, Any]],
) -> dict[str, Any]:
    """Keep late records out of scores and compare models on shared released periods."""
    prints = {(r["target"], r["reference_period"]): r for r in first_prints}
    scored = []
    pending: Counter[tuple[str, str]] = Counter()
    late = 0
    for row in rows:
        key = (row["target"], row["reference_period"])
        actual = prints.get(key)
        if actual is None:
            pending[key] += 1
            continue
        released = date.fromisoformat(actual["release_date"])
        if date.fromisoformat(row["recorded_at_utc"][:10]) >= released:
            late += 1
            continue
        forecast, value = float(row["point_forecast"]), float(actual["first_print"])
        if not math.isfinite(forecast) or not math.isfinite(value):
            raise ValueError("Track record values must be finite.")
        scored.append({
            "target": key[0], "reference_period": key[1], "model_id": row["model_id"],
            "forecast": forecast, "actual": value,
            "abs_error": float(abs(Decimal(str(forecast)) - Decimal(str(value)))),
            "as_of": row["as_of"], "recorded_at_utc": row["recorded_at_utc"],
            "release_date": actual["release_date"], "sequence": row["sequence"],
        })
    baseline = {
        (r["target"], r["reference_period"]): r["abs_error"]
        for r in scored if r["model_id"] == "naive"
    }
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in scored:
        groups[(row["target"], row["model_id"])].append(row)
    summary = []
    for (target, model), group in sorted(groups.items(), key=lambda item: (
        item[0][0], model_order(item[0][1]),
    )):
        errors = [r["abs_error"] for r in group]
        paired = [r for r in group if (target, r["reference_period"]) in baseline]
        summary.append({
            "target": target, "model_id": model, "n": len(group),
            "mae": round(sum(errors) / len(errors), 4),
            "rmse": round(math.sqrt(sum(e * e for e in errors) / len(errors)), 4),
            "beat_naive": None if model == "naive" or not paired else sum(
                r["abs_error"] < baseline[(target, r["reference_period"])] for r in paired
            ),
        })
    scored.sort(key=lambda r: (r["target"], r["reference_period"], model_order(r["model_id"])))
    return {
        "schema_version": 1,
        "scored": [{**r, **{k: round(r[k], 4) for k in ("forecast", "actual", "abs_error")}}
                   for r in scored],
        "late": late,
        "pending": [{"target": t, "reference_period": p, "rows": n}
                    for (t, p), n in sorted(pending.items())],
        "summary": summary, "ledger_rows": len(rows),
    }
