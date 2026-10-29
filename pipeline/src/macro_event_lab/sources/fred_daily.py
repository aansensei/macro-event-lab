"""Daily market series from FRED, such as the 2 and 10 year Treasury yields (DGS2, DGS10).

ALFRED cannot return every vintage of a long daily series in one request, and these closes are
not revised in practice. So the current vintage is downloaded and each value is treated as known
from its own date; the silver build then makes it known at the end of that New York day.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import save_raw
from macro_event_lab.sources.alfred import PAGE_LIMIT

KIND = "fred.daily"


def ingest_daily(client: RateLimitedClient, raw_dir: Path, series_id: str, api_key: str) -> int:
    """Download the current values of one daily series into the raw store. Returns rows reported."""
    offset = 0
    while True:
        params = {
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
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


def parse_daily(series_id: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Rows in the ALFRED observation shape, each known from its own observation date."""
    rows = []
    for obs in payload.get("observations", []):
        day = date.fromisoformat(obs["date"])
        rows.append(
            {
                "series_id": series_id,
                "observation_date": day,
                "value": None if obs["value"] in {".", ""} else float(obs["value"]),
                "realtime_start": day,
                "realtime_end": None,
            }
        )
    return rows
