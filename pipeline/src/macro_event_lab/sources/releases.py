"""Release calendar: when each CPI, jobs, GDP and FOMC number became public.

FRED `release/dates` gives the dates of BLS/BEA releases (dates only, including scheduled
future dates); FOMC dates come from a seed file built from the Fed's calendar page. The
official release time of day is attached in `calendar_rows`.
Docs: https://fred.stlouisfed.org/docs/api/fred/release_dates.html
"""

from __future__ import annotations

import csv
from datetime import date, datetime, time
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from macro_event_lab.config import RELEASE_TZ, RELEASES
from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import save_raw

KIND = "fred.release_dates"
PAGE_LIMIT = 10_000
FOMC_SEED = Path(__file__).resolve().parents[1] / "seeds" / "fomc_meetings.csv"


def ingest_release_dates(
    client: RateLimitedClient, raw_dir: Path, release: str, release_id: int, api_key: str
) -> int:
    """Download every past and scheduled date of one FRED release. Returns dates reported."""
    offset = 0
    while True:
        params = {
            "release_id": release_id,
            "api_key": api_key,
            "file_type": "json",
            "include_release_dates_with_no_data": "true",
            "limit": PAGE_LIMIT,
            "offset": offset,
        }
        response = client.get("/release/dates", params=params)
        save_raw(
            raw_dir,
            KIND,
            str(response.url.copy_with(query=None)),
            params,
            response.content,
            meta={"release": release, "release_id": release_id, "offset": offset},
        )
        payload = response.json()
        dates = payload.get("release_dates", [])
        total = int(payload.get("count", len(dates)))
        offset += len(dates)
        if not dates or offset >= total:
            return total


def parse_release_dates(payload: dict[str, Any]) -> list[date]:
    return [date.fromisoformat(d["date"]) for d in payload.get("release_dates", [])]


def fomc_statement_dates(seed: Path = FOMC_SEED) -> list[date]:
    """Statement dates of scheduled FOMC meetings (notation votes have no set release time)."""
    with seed.open(encoding="utf-8") as f:
        return [
            date.fromisoformat(row["statement_date"])
            for row in csv.DictReader(f)
            if row["meeting_type"] == "scheduled_meeting"
        ]


def release_ts(release: str, day: date) -> datetime:
    """The official release moment of `release` on `day`, as an aware New York datetime.

    Going through the New York time zone keeps 08:30 correct across daylight saving changes.
    """
    hour, minute = map(int, RELEASES[release].local_time.split(":"))
    return datetime.combine(day, time(hour, minute), ZoneInfo(RELEASE_TZ))


def calendar_rows(release: str, days: list[date], source: str) -> list[dict[str, Any]]:
    return [
        {
            "release": release,
            "release_date": day,
            "release_ts": release_ts(release, day),
            "source": source,
        }
        for day in days
    ]
