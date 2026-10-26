"""ALFRED (archival FRED): every published vintage of a macro series.

With realtime_start=1776-07-04 and realtime_end=9999-12-31, `fred/series/observations`
returns one row per (observation date, vintage window): the value that was known from
`realtime_start` until `realtime_end`. That is exactly the bitemporal shape we need.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import save_raw

KIND = "alfred.observations"
PAGE_LIMIT = 100_000
REALTIME_START = "1776-07-04"
REALTIME_END = "9999-12-31"


def ingest_series(
    client: RateLimitedClient, raw_dir: Path, series_id: str, api_key: str
) -> int:
    """Download all vintages of one series into the raw store. Returns rows reported."""
    offset = 0
    total = 0
    while True:
        params = {
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "realtime_start": REALTIME_START,
            "realtime_end": REALTIME_END,
            "limit": PAGE_LIMIT,
            "offset": offset,
        }
        response = client.get("/series/observations", params=params)
        save_raw(
            raw_dir,
            KIND,
            str(response.url.copy_with(query=None)),
            params,
            response.content,
            meta={"series_id": series_id, "offset": offset},
        )
        payload = response.json()
        observations = payload.get("observations", [])
        total = int(payload.get("count", len(observations)))
        offset += len(observations)
        if not observations or offset >= total:
            return total


def _to_date(value: str) -> date | None:
    if value == REALTIME_END:
        return None  # still the current vintage
    return date.fromisoformat(value)


def _to_float(value: str) -> float | None:
    return None if value in {".", ""} else float(value)


def parse_observations(series_id: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    """One row per (series, observation_date, vintage). `known_from` = realtime_start.

    Week 2 replaces the date-only `known_from` with the exact release time from BLS/BEA calendars.
    """
    rows = []
    for obs in payload.get("observations", []):
        rows.append(
            {
                "series_id": series_id,
                "observation_date": date.fromisoformat(obs["date"]),
                "value": _to_float(obs["value"]),
                "realtime_start": date.fromisoformat(obs["realtime_start"]),
                "realtime_end": _to_date(obs["realtime_end"]),
            }
        )
    return rows
