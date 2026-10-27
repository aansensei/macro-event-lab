import json
from datetime import UTC, date, datetime

import polars as pl

from macro_event_lab.build import build_silver
from macro_event_lab.config import Paths
from macro_event_lab.raw_store import save_raw
from macro_event_lab.sources.releases import (
    fomc_statement_dates,
    parse_release_dates,
    release_ts,
)


def test_release_time_follows_daylight_saving():
    # 08:30 New York is 12:30 UTC in summer (EDT) and 13:30 UTC in winter (EST)
    assert release_ts("cpi", date(2026, 7, 14)).astimezone(UTC).hour == 12
    assert release_ts("cpi", date(2026, 1, 13)).astimezone(UTC).hour == 13
    assert release_ts("fomc", date(2026, 9, 16)).astimezone(UTC) == datetime(
        2026, 9, 16, 18, 0, tzinfo=UTC
    )


def test_parse_release_dates():
    payload = {"release_dates": [
        {"release_id": 10, "date": "2026-10-14"}, {"release_id": 10, "date": "2026-11-10"},
    ]}
    assert parse_release_dates(payload) == [date(2026, 10, 14), date(2026, 11, 10)]


def test_fomc_seed_skips_notation_votes():
    dates = fomc_statement_dates()
    assert date(2025, 8, 22) not in dates  # notation vote, no 2:00 p.m. statement
    assert date(2026, 9, 16) in dates
    assert dates == sorted(dates)


def _release_page(dates: list[str]) -> bytes:
    return json.dumps({"count": len(dates), "release_dates": [
        {"release_id": 10, "date": d} for d in dates
    ]}).encode()


def test_calendar_uses_only_the_newest_fetch(tmp_path):
    # The older fetch still lists 2025-10-15, which the shutdown moved to 2025-10-24
    paths = Paths(tmp_path)
    meta = {"release": "cpi", "release_id": 10, "offset": 0}
    save_raw(paths.raw, "fred.release_dates", "u", {}, _release_page(["2025-09-11", "2025-10-15"]),
             meta, datetime(2025, 10, 1, tzinfo=UTC))
    save_raw(paths.raw, "fred.release_dates", "u", {}, _release_page(["2025-09-11", "2025-10-24"]),
             meta, datetime(2025, 10, 20, tzinfo=UTC))

    build_silver(paths)
    cal = pl.read_parquet(paths.silver / "release_calendar.parquet").filter(release="cpi")

    assert cal["release_date"].to_list() == [date(2025, 9, 11), date(2025, 10, 24)]
    assert cal["release_ts"][1] == datetime(2025, 10, 24, 12, 30, tzinfo=UTC)
