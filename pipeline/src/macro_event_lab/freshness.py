"""Freshness checks for the public status snapshot."""

from __future__ import annotations

import json
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any


def stale_sources(status: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return copies of source dicts whose is_fresh flag is explicitly False."""
    sources = status.get("sources")
    if not isinstance(sources, list):
        return []
    return [
        dict(source)
        for source in sources
        if isinstance(source, Mapping) and source.get("is_fresh") is False
    ]


def format_report(stale: Sequence[Mapping[str, Any]], information_date: str) -> str:
    """Format a plain text summary of source freshness."""
    if not stale:
        return f"OK: all sources are fresh as of {information_date}"
    lines = [f"STALE: {len(stale)} source(s) older than allowed as of {information_date}"]
    for source in stale:
        lines.append(
            f"* {source.get('id')}: latest {source.get('latest_vintage_date')}, "
            f"allowed {source.get('max_age_days')} days"
        )
    return "\n".join(lines)


def check_status_file(status_path: Path) -> int:
    """Read status JSON, print a freshness report, and return the exit code."""
    try:
        raw_text = status_path.read_text(encoding="utf-8")
    except OSError as exc:
        detail = str(exc).splitlines()[0] if str(exc) else "unreadable file"
        print(f"Cannot read status file {status_path}: {detail}", file=sys.stderr)
        return 2

    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        detail = str(exc).splitlines()[0] if str(exc) else "invalid JSON"
        print(f"Invalid JSON in status file {status_path}: {detail}", file=sys.stderr)
        return 2

    if not isinstance(payload, dict) or not isinstance(payload.get("sources"), list):
        print(f"Status file has no sources list: {status_path}", file=sys.stderr)
        return 2

    information_date = str(payload.get("information_date") or "unknown")
    stale = stale_sources(payload)
    print(format_report(stale, information_date))
    return 1 if stale else 0
