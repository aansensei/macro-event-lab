from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from datetime import UTC, date, datetime

import polars as pl

from macro_event_lab.briefing import (
    atom_text,
    build_briefing,
    ics_text,
    next_first_print,
    write_briefing,
)
from macro_event_lab.config import Paths

CALENDAR_SCHEMA = {
    "release": pl.String,
    "release_date": pl.Date,
    "release_ts": pl.Datetime("us", "UTC"),
    "source": pl.String,
}


def _calendar(rows: list[tuple[str, date, datetime, str]]) -> pl.DataFrame:
    return pl.DataFrame(rows, schema=CALENDAR_SCHEMA, orient="row")


def _utc(year: int, month: int, day: int, hour: int, minute: int) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


def _sample_arena() -> dict:
    return {
        "schema_version": 1,
        "information_date": "2026-11-24",
        "targets": [
            {
                "id": "gdp",
                "label": "GDP growth",
                "unit": "annualized percent q/q",
                "frequency": "quarterly",
            },
            {"id": "cpi", "label": "CPI", "unit": "percent m/m", "frequency": "monthly"},
            {
                "id": "payrolls",
                "label": "Payrolls",
                "unit": "thousands of jobs",
                "frequency": "monthly",
            },
        ],
        "contestants": [
            {"id": "naive", "label": "Naive", "kind": "baseline", "note": ""},
            {"id": "ar", "label": "Autoregression", "kind": "classical", "note": ""},
            {"id": "spf", "label": "Professional forecasters", "kind": "human", "note": ""},
        ],
        "forecasts": [
            {
                "target": "cpi",
                "period": "2026-09-01",
                "made_on": "2026-09-15",
                "actual": 0.2,
                "values": {"naive": 0.1},
                "intervals": {},
            },
            {
                "target": "cpi",
                "period": "2026-10-01",
                "made_on": "2026-10-15",
                "actual": 0.4,
                "values": {"naive": 0.2},
                "intervals": {},
            },
            {
                "target": "cpi",
                "period": "2026-11-01",
                "made_on": "2026-11-15",
                "actual": None,
                "values": {"naive": 0.4},
                "intervals": {},
            },
            {
                "target": "payrolls",
                "period": "2026-10-01",
                "made_on": "2026-10-15",
                "actual": 165.0,
                "values": {"naive": 120.0},
                "intervals": {},
            },
        ],
        "scores": [],
        "leakage": [],
        "live": [
            {
                "target": "gdp",
                "period": "2026-10-01",
                "as_of": "2026-11-24",
                "values": {"spf": 2.3, "naive": 3.4},
            },
            {
                "target": "cpi",
                "period": "2026-11-01",
                "as_of": "2026-11-24",
                "values": {"ar": 0.2437, "naive": 0.4, "spf": None},
            },
            {
                "target": "payrolls",
                "period": "2026-11-01",
                "as_of": "2026-11-24",
                "values": {"naive": 165.0, "ar": 99.6927},
            },
        ],
    }


def test_next_first_print_is_the_first_release_after_the_period_end() -> None:
    cal = _calendar(
        [
            ("cpi", date(2026, 11, 13), _utc(2026, 11, 13, 13, 30), "test"),
            ("cpi", date(2026, 12, 10), _utc(2026, 12, 10, 13, 30), "test"),
            ("cpi", date(2027, 1, 12), _utc(2027, 1, 12, 13, 30), "test"),
        ]
    )
    result = next_first_print(cal, "cpi", date(2026, 11, 1))
    assert result == (date(2026, 12, 10), _utc(2026, 12, 10, 13, 30))


def test_next_first_print_for_a_quarter_skips_the_second_estimate() -> None:
    cal = _calendar(
        [
            ("gdp", date(2026, 1, 29), _utc(2026, 1, 29, 13, 30), "test"),
            ("gdp", date(2026, 2, 26), _utc(2026, 2, 26, 13, 30), "test"),
            ("gdp", date(2026, 3, 26), _utc(2026, 3, 26, 12, 30), "test"),
            ("gdp", date(2026, 4, 29), _utc(2026, 4, 29, 12, 30), "test"),
        ]
    )
    result = next_first_print(cal, "gdp", date(2026, 1, 1))
    assert result == (date(2026, 4, 29), _utc(2026, 4, 29, 12, 30))


def test_next_first_print_is_none_when_nothing_is_scheduled() -> None:
    cal = _calendar(
        [
            ("employment_situation", date(2026, 11, 6), _utc(2026, 11, 6, 13, 30), "test"),
        ]
    )
    assert next_first_print(cal, "payrolls", date(2026, 11, 1)) is None


def test_build_briefing_orders_releases_and_lists_forecasts_in_contestant_order() -> None:
    cal = _calendar(
        [
            ("cpi", date(2026, 12, 10), _utc(2026, 12, 10, 13, 30), "test"),
            ("employment_situation", date(2026, 12, 4), _utc(2026, 12, 4, 13, 30), "test"),
        ]
    )
    briefing = build_briefing(_sample_arena(), cal, date(2026, 11, 24))
    assert briefing["schema_version"] == 1
    assert briefing["information_date"] == "2026-11-24"
    assert [r["target"] for r in briefing["releases"]] == ["payrolls", "cpi", "gdp"]
    cpi_entry = briefing["releases"][1]
    assert [f["id"] for f in cpi_entry["forecasts"]] == ["naive", "ar"]
    gdp_entry = briefing["releases"][2]
    assert gdp_entry["release_date"] is None
    assert [f["id"] for f in gdp_entry["forecasts"]] == ["naive", "spf"]


def test_build_briefing_sets_last_first_print_from_the_earlier_period() -> None:
    cal = _calendar([])
    briefing = build_briefing(_sample_arena(), cal, date(2026, 11, 24))
    by_target = {r["target"]: r for r in briefing["releases"]}
    assert by_target["cpi"]["last_first_print"] == 0.4
    assert by_target["payrolls"]["last_first_print"] == 165.0
    assert by_target["gdp"]["last_first_print"] is None


def test_ics_has_crlf_unique_uids_and_folds_long_lines() -> None:
    long_label = ("Very Long Contestant Name " * 5).strip()
    briefing = {
        "schema_version": 1,
        "information_date": "2026-11-24",
        "releases": [
            {
                "target": "cpi",
                "label": "CPI",
                "unit": "percent m/m",
                "period": "2026-11-01",
                "release_date": "2026-12-10",
                "release_ts_utc": "2026-12-10T13:30:00Z",
                "forecasts": [
                    {"id": "long", "label": long_label, "kind": "classical", "value": 0.3},
                ],
                "last_first_print": 0.4,
            },
            {
                "target": "payrolls",
                "label": "Payrolls",
                "unit": "thousands of jobs",
                "period": "2026-11-01",
                "release_date": "2026-12-04",
                "release_ts_utc": "2026-12-04T13:30:00Z",
                "forecasts": [
                    {"id": "naive", "label": "Naive", "kind": "baseline", "value": 165.0},
                ],
                "last_first_print": 165.0,
            },
        ],
    }
    text = ics_text(briefing)
    assert "\r\n" in text
    assert "\n" not in text.replace("\r\n", "")
    physical_lines = text.split("\r\n")[:-1]
    assert all(len(line.encode("utf-8")) <= 75 for line in physical_lines)
    unfolded = text.replace("\r\n ", "").split("\r\n")
    uids = [line for line in unfolded if line.startswith("UID:")]
    assert uids == [
        "UID:mel-cpi-2026-11-01@aansensei.dev",
        "UID:mel-payrolls-2026-11-01@aansensei.dev",
    ]
    assert len(set(uids)) == 2
    assert "DTSTART:20261210T133000Z" in unfolded
    assert "DTEND:20261210T140000Z" in unfolded
    assert "SUMMARY:US CPI release\\, November 2026 data" in unfolded


def test_ics_escapes_commas_and_semicolons() -> None:
    briefing = {
        "schema_version": 1,
        "information_date": "2026-11-24",
        "releases": [
            {
                "target": "payrolls",
                "label": "Payrolls, US",
                "unit": "thousands of jobs",
                "period": "2026-11-01",
                "release_date": "2026-12-04",
                "release_ts_utc": "2026-12-04T13:30:00Z",
                "forecasts": [
                    {
                        "id": "a",
                        "label": "Alpha; Beta, Inc.",
                        "kind": "classical",
                        "value": 165.0,
                    },
                    {"id": "b", "label": "Gamma\\Delta", "kind": "baseline", "value": 99.6927},
                ],
                "last_first_print": None,
            }
        ],
    }
    unfolded = ics_text(briefing).replace("\r\n ", "")
    assert "SUMMARY:US Payrolls\\, US release\\, November 2026 data\r\n" in unfolded
    assert (
        "DESCRIPTION:Alpha\\; Beta\\, Inc. 165.0\\; Gamma\\\\Delta 99.7\\n"
        "Current forecasts\\, preliminary results.\r\n"
    ) in unfolded


def test_atom_parses_and_escapes_text() -> None:
    briefing = {
        "schema_version": 1,
        "information_date": "2026-11-24",
        "releases": [
            {
                "target": "gdp",
                "label": "GDP & growth",
                "unit": "annualized percent q/q",
                "period": "2026-10-01",
                "release_date": "2027-01-29",
                "release_ts_utc": "2027-01-29T13:30:00Z",
                "forecasts": [{"id": "a", "label": "A < B & C", "kind": "classical", "value": 2.4}],
                "last_first_print": None,
            }
        ],
    }
    xml_text = atom_text(briefing, "https://aansensei.dev/macro-event-lab/")
    root = ET.fromstring(xml_text)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    feed_id = "https://aansensei.dev/macro-event-lab/data/feed.xml"
    entry_id = "https://aansensei.dev/macro-event-lab/#release-gdp-2026-10-01"
    assert root.tag == "{http://www.w3.org/2005/Atom}feed"
    assert root.findtext("atom:id", namespaces=ns) == feed_id
    assert root.findtext("atom:updated", namespaces=ns) == "2026-11-24T00:00:00Z"
    entries = root.findall("atom:entry", namespaces=ns)
    assert len(entries) == 1
    assert entries[0].findtext("atom:id", namespaces=ns) == entry_id
    expected_title = "US GDP & growth release, Q4 2026 data"
    assert entries[0].findtext("atom:title", namespaces=ns) == expected_title
    assert "A < B & C 2.4" in (entries[0].findtext("atom:summary", namespaces=ns) or "")


def test_empty_briefing_gives_a_valid_feed_and_calendar() -> None:
    empty = {"schema_version": 1, "information_date": "2026-11-24", "releases": []}
    cal_text = ics_text(empty)
    assert cal_text.startswith("BEGIN:VCALENDAR\r\n")
    assert cal_text.endswith("END:VCALENDAR\r\n")
    assert "BEGIN:VEVENT" not in cal_text
    feed_root = ET.fromstring(atom_text(empty, "https://aansensei.dev/macro-event-lab/"))
    assert feed_root.findall("{http://www.w3.org/2005/Atom}entry") == []


def test_write_briefing_writes_three_files_from_the_arena_file(tmp_path) -> None:
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    out = tmp_path / "web_public"
    out.mkdir(parents=True)
    (out / "arena.json").write_text(json.dumps(_sample_arena()), encoding="utf-8")
    _calendar(
        [
            ("employment_situation", date(2026, 12, 4), _utc(2026, 12, 4, 13, 30), "test"),
            ("cpi", date(2026, 12, 10), _utc(2026, 12, 10, 13, 30), "test"),
        ]
    ).write_parquet(paths.silver / "release_calendar.parquet")

    json_path, ics_path, feed_path = write_briefing(paths, date(2026, 11, 24), out)
    assert json_path.exists()
    assert ics_path.exists()
    assert feed_path.exists()
    raw_json = json_path.read_text(encoding="utf-8")
    assert raw_json.endswith("\n")
    assert "\n  " in raw_json
    loaded = json.loads(raw_json)
    assert loaded["schema_version"] == 1
    assert [r["target"] for r in loaded["releases"]] == ["payrolls", "cpi", "gdp"]
    assert b"\r\n" in ics_path.read_bytes()
    assert ET.fromstring(feed_path.read_text(encoding="utf-8")).tag.endswith("feed")
