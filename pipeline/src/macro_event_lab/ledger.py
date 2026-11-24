"""Append-only SHA-256 hash-chained forecast ledger and verifier."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

GENESIS_HASH = "0" * 64

FIELDS = (
    "sequence",
    "forecast_id",
    "target",
    "reference_period",
    "model_id",
    "point_forecast",
    "as_of",
    "recorded_at_utc",
    "prev_hash",
    "entry_hash",
)


def canonical_json(row: dict[str, Any]) -> str:
    """Serialize a ledger row without entry_hash into canonical ASCII JSON."""
    payload = {key: value for key, value in row.items() if key != "entry_hash"}
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def entry_hash(row: dict[str, Any]) -> str:
    """Compute the SHA-256 hex digest of a row's canonical JSON representation."""
    return hashlib.sha256(canonical_json(row).encode("utf-8")).hexdigest()


def build_rows(
    fields: list[dict[str, Any]], last_hash: str, last_sequence: int
) -> list[dict[str, Any]]:
    """Build complete hash-chained ledger rows starting after last_sequence and last_hash."""
    rows: list[dict[str, Any]] = []
    prev_hash = last_hash
    for offset, item in enumerate(fields, start=1):
        sequence = last_sequence + offset
        as_of_compact = str(item["as_of"]).replace("-", "")
        forecast_id = f"fc_{as_of_compact}_{item['target']}_{item['model_id']}"
        row: dict[str, Any] = {
            "sequence": sequence,
            "forecast_id": forecast_id,
            "target": item["target"],
            "reference_period": item["reference_period"],
            "model_id": item["model_id"],
            "point_forecast": item["point_forecast"],
            "as_of": item["as_of"],
            "recorded_at_utc": item["recorded_at_utc"],
            "prev_hash": prev_hash,
        }
        row["entry_hash"] = entry_hash(row)
        rows.append(row)
        prev_hash = str(row["entry_hash"])
    return rows


def read_ledger(path: str | Path) -> list[dict[str, Any]]:
    """Read a JSON lines ledger file; return an empty list if the file is missing."""
    ledger_path = Path(path)
    if not ledger_path.exists():
        return []
    lines = ledger_path.read_text(encoding="utf-8").splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def append_rows(path: str | Path, rows: list[dict[str, Any]]) -> None:
    """Append rows as canonical JSON lines, creating parent folders and the file if needed."""
    ledger_path = Path(path)
    ledger_path.parent.mkdir(parents=True, exist_ok=True)
    with ledger_path.open("a", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n")


def entries_from_arena(
    arena: dict[str, Any],
    recorded_at_utc: str,
    existing: set[tuple[str, str, str]],
) -> list[dict[str, Any]]:
    """Extract sorted field dictionaries from arena live rows, skipping missing and known keys."""
    entries: list[dict[str, Any]] = []
    for live_row in arena.get("live", []):
        target = str(live_row["target"])
        reference_period = str(live_row["period"])
        as_of = str(live_row["as_of"])
        values = live_row.get("values", {})
        for model_id, raw_value in values.items():
            if raw_value is None:
                continue
            model_name = str(model_id)
            if (target, reference_period, model_name) in existing:
                continue
            entries.append(
                {
                    "target": target,
                    "reference_period": reference_period,
                    "model_id": model_name,
                    "point_forecast": round(float(raw_value), 4),
                    "as_of": as_of,
                    "recorded_at_utc": recorded_at_utc,
                }
            )
    entries.sort(key=lambda item: (item["target"], item["reference_period"], item["model_id"]))
    return entries


def _parse_utc(timestamp: str) -> datetime:
    parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def verify_ledger(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Verify hash chain, sequence continuity, and monotonic timestamps across ledger rows."""
    problems: list[dict[str, Any]] = []
    for index, row in enumerate(rows):
        if index == 0 and (row.get("sequence") != 1 or row.get("prev_hash") != GENESIS_HASH):
            problems.append({"index": index, "code": "GENESIS"})
        if row.get("entry_hash") != entry_hash(row):
            problems.append({"index": index, "code": "HASH_MISMATCH"})
        if index > 0:
            previous = rows[index - 1]
            prev_sequence = previous.get("sequence")
            if not isinstance(prev_sequence, int) or row.get("sequence") != prev_sequence + 1:
                problems.append({"index": index, "code": "SEQUENCE_BREAK"})
            if row.get("prev_hash") != previous.get("entry_hash"):
                problems.append({"index": index, "code": "PREV_HASH_MISMATCH"})
            if _parse_utc(str(row.get("recorded_at_utc", ""))) < _parse_utc(
                str(previous.get("recorded_at_utc", ""))
            ):
                problems.append({"index": index, "code": "TIME_ORDER"})
    return problems
