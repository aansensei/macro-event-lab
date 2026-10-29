from datetime import date

from macro_event_lab.sources.fred_daily import parse_daily

# the current vintage as FRED returns it: every row shares today's realtime window
PAYLOAD = {
    "count": 3,
    "observations": [
        {"realtime_start": "2026-10-28", "realtime_end": "2026-10-28",
         "date": "2026-10-02", "value": "3.58"},
        {"realtime_start": "2026-10-28", "realtime_end": "2026-10-28",
         "date": "2026-10-05", "value": "3.61"},
        {"realtime_start": "2026-10-28", "realtime_end": "2026-10-28",
         "date": "2026-10-13", "value": "."},
    ],
}


def test_each_close_is_known_from_its_own_date():
    rows = parse_daily("DGS2", PAYLOAD)
    starts = [r["realtime_start"] for r in rows]
    assert starts == [date(2026, 10, 2), date(2026, 10, 5), date(2026, 10, 13)]
    assert all(r["realtime_end"] is None for r in rows)
    assert rows[0] == {
        "series_id": "DGS2", "observation_date": date(2026, 10, 2), "value": 3.58,
        "realtime_start": date(2026, 10, 2), "realtime_end": None,
    }


def test_holiday_value_is_none():
    assert parse_daily("DGS2", PAYLOAD)[2]["value"] is None
