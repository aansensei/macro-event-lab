"""Contract tests for source freshness reporting and the check-freshness CLI."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest


def _freshness_api():
    from macro_event_lab.freshness import format_report, stale_sources

    return format_report, stale_sources


def _make_source(
    source_id: str,
    *,
    is_fresh: object = True,
    latest_vintage_date: str = "2026-11-20",
    max_age_days: int = 7,
) -> dict[str, object]:
    return {
        "id": source_id,
        "latest_vintage_date": latest_vintage_date,
        "series_count": 4,
        "rows": 100,
        "max_age_days": max_age_days,
        "is_fresh": is_fresh,
    }


def _make_status(
    sources: list[dict[str, object]],
    information_date: str = "2026-11-24",
) -> dict[str, object]:
    return {
        "schema_version": 1,
        "generated_at": "2026-11-24T15:00:00Z",
        "information_date": information_date,
        "sources": sources,
        "checks": [],
    }


def _run_cli(status_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "macro_event_lab",
            "check-freshness",
            "--status",
            str(status_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def test_stale_sources_empty_list() -> None:
    _, stale_sources = _freshness_api()
    status = _make_status([])
    assert stale_sources(status) == []


def test_stale_sources_one_stale() -> None:
    _, stale_sources = _freshness_api()
    fresh = _make_source("alfred", is_fresh=True)
    stale = _make_source("spf", is_fresh=False, latest_vintage_date="2026-06-01", max_age_days=120)
    status = _make_status([fresh, stale])
    assert stale_sources(status) == [stale]


def test_stale_sources_all_stale_preserves_order() -> None:
    _, stale_sources = _freshness_api()
    first = _make_source("alfred", is_fresh=False)
    second = _make_source("spf", is_fresh=False, latest_vintage_date="2026-06-01", max_age_days=120)
    status = _make_status([first, second])
    assert stale_sources(status) == [first, second]


def test_stale_sources_mixed_preserves_order() -> None:
    _, stale_sources = _freshness_api()
    s1 = _make_source("s1", is_fresh=True)
    s2 = _make_source("s2", is_fresh=False)
    s3 = _make_source("s3", is_fresh=True)
    s4 = _make_source("s4", is_fresh=False)
    status = _make_status([s1, s2, s3, s4])
    result = stale_sources(status)
    assert [item["id"] for item in result] == ["s2", "s4"]


def test_stale_sources_returns_copies_not_aliases() -> None:
    _, stale_sources = _freshness_api()
    original = _make_source("alfred", is_fresh=False)
    status = _make_status([copy.deepcopy(original)])
    result = stale_sources(status)
    assert len(result) == 1
    assert result[0] is not status["sources"][0]

    result[0]["id"] = "mutated"
    result[0]["max_age_days"] = 999
    assert status["sources"][0]["id"] == "alfred"
    assert status["sources"][0]["max_age_days"] == 7

    status["sources"][0]["rows"] = 0
    assert result[0]["rows"] == 100


def test_stale_sources_none_or_missing_or_non_bool_is_not_stale() -> None:
    _, stale_sources = _freshness_api()
    missing_key = _make_source("missing")
    del missing_key["is_fresh"]
    sources = [
        _make_source("fresh", is_fresh=True),
        _make_source("null_flag", is_fresh=None),
        missing_key,
        _make_source("string_false", is_fresh="false"),
        _make_source("zero_int", is_fresh=0),
        _make_source("actual_stale", is_fresh=False),
    ]
    result = stale_sources(_make_status(sources))
    assert [item["id"] for item in result] == ["actual_stale"]


def test_format_report_empty_returns_ok_text() -> None:
    format_report, _ = _freshness_api()
    assert format_report([], "2026-11-24") == "OK: all sources are fresh as of 2026-11-24"


def test_format_report_single_and_multiple_stale() -> None:
    format_report, _ = _freshness_api()
    alfred = _make_source(
        "alfred", is_fresh=False, latest_vintage_date="2026-11-10", max_age_days=7,
    )
    spf = _make_source(
        "spf", is_fresh=False, latest_vintage_date="2026-06-01", max_age_days=120,
    )
    assert format_report([alfred], "2026-11-24") == (
        "STALE: 1 source(s) older than allowed as of 2026-11-24\n"
        "* alfred: latest 2026-11-10, allowed 7 days"
    )
    assert format_report([alfred, spf], "2026-11-24") == (
        "STALE: 2 source(s) older than allowed as of 2026-11-24\n"
        "* alfred: latest 2026-11-10, allowed 7 days\n"
        "* spf: latest 2026-06-01, allowed 120 days"
    )


def test_cli_exit_0_for_fresh_and_empty_sources(tmp_path: Path) -> None:
    _freshness_api()
    fresh_path = tmp_path / "status_fresh.json"
    fresh_path.write_text(
        json.dumps(_make_status([_make_source("alfred", is_fresh=True)])),
        encoding="utf-8",
    )
    res_fresh = _run_cli(fresh_path)
    assert res_fresh.returncode == 0
    assert res_fresh.stdout.strip() == "OK: all sources are fresh as of 2026-11-24"
    assert res_fresh.stderr == ""

    empty_path = tmp_path / "status_empty.json"
    empty_path.write_text(json.dumps(_make_status([])), encoding="utf-8")
    res_empty = _run_cli(empty_path)
    assert res_empty.returncode == 0
    assert res_empty.stdout.strip() == "OK: all sources are fresh as of 2026-11-24"
    assert res_empty.stderr == ""


def test_cli_exit_1_for_stale_source(tmp_path: Path) -> None:
    _freshness_api()
    stale_path = tmp_path / "status_stale.json"
    payload = _make_status([
        _make_source("alfred", is_fresh=False, latest_vintage_date="2026-11-10", max_age_days=7),
        _make_source("spf", is_fresh=True, latest_vintage_date="2026-11-01", max_age_days=120),
    ])
    stale_path.write_text(json.dumps(payload), encoding="utf-8")
    res = _run_cli(stale_path)
    assert res.returncode == 1
    assert res.stdout.strip() == (
        "STALE: 1 source(s) older than allowed as of 2026-11-24\n"
        "* alfred: latest 2026-11-10, allowed 7 days"
    )
    assert res.stderr == ""


@pytest.mark.parametrize(
    ("filename", "content"),
    [
        ("missing.json", None),
        ("invalid.json", "{not valid json"),
        ("no_sources.json", json.dumps({"information_date": "2026-11-24"})),
        ("bad_sources_type.json", json.dumps({"information_date": "2026-11-24", "sources": "no"})),
        ("list_root.json", json.dumps([])),
    ],
)
def test_cli_exit_2_on_missing_or_invalid_status(
    tmp_path: Path, filename: str, content: str | None,
) -> None:
    _freshness_api()
    path = tmp_path / filename
    if content is not None:
        path.write_text(content, encoding="utf-8")
    res = _run_cli(path)
    assert res.returncode == 2
    err_lines = res.stderr.strip().splitlines()
    assert len(err_lines) == 1
    assert len(err_lines[0]) > 0
