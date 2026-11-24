from __future__ import annotations

import json
from pathlib import Path

import pytest

from macro_event_lab import cli, freshness


def test_stale_sources_returns_only_sources_marked_not_fresh_in_order() -> None:
    status = {
        "information_date": "2026-11-24",
        "sources": [
            {
                "id": "alfred",
                "latest_vintage_date": "2026-11-23",
                "max_age_days": 7,
                "is_fresh": True,
            },
            {
                "id": "spf",
                "latest_vintage_date": "2026-05-01",
                "max_age_days": 120,
                "is_fresh": False,
            },
            {"id": "missing_flag", "latest_vintage_date": "2026-11-01", "max_age_days": 7},
            {
                "id": "none_flag",
                "latest_vintage_date": "2026-11-01",
                "max_age_days": 7,
                "is_fresh": None,
            },
            {
                "id": "other",
                "latest_vintage_date": "2026-10-01",
                "max_age_days": 10,
                "is_fresh": False,
            },
        ],
    }
    stale = freshness.stale_sources(status)
    assert [entry["id"] for entry in stale] == ["spf", "other"]


def test_stale_sources_returns_copies() -> None:
    status = {
        "information_date": "2026-11-24",
        "sources": [
            {
                "id": "alfred",
                "latest_vintage_date": "2026-11-01",
                "max_age_days": 7,
                "is_fresh": False,
            },
        ],
    }
    stale = freshness.stale_sources(status)
    assert len(stale) == 1
    stale[0]["is_fresh"] = True
    stale[0]["id"] = "mutated"
    assert status["sources"][0]["is_fresh"] is False
    assert status["sources"][0]["id"] == "alfred"


def test_format_report_for_fresh_and_stale() -> None:
    assert freshness.format_report([], "2026-11-24") == (
        "OK: all sources are fresh as of 2026-11-24"
    )
    stale = [
        {
            "id": "alfred",
            "latest_vintage_date": "2026-11-01",
            "max_age_days": 7,
            "is_fresh": False,
        },
        {
            "id": "spf",
            "latest_vintage_date": "2026-05-01",
            "max_age_days": 120,
            "is_fresh": False,
        },
    ]
    assert freshness.format_report(stale, "2026-11-24") == (
        "STALE: 2 source(s) older than allowed as of 2026-11-24\n"
        "* alfred: latest 2026-11-01, allowed 7 days\n"
        "* spf: latest 2026-05-01, allowed 120 days"
    )


def test_cli_exit_codes_for_fresh_stale_missing_and_invalid_files(
    tmp_path: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    fresh_path = tmp_path / "fresh.json"
    fresh_path.write_text(
        json.dumps({
            "information_date": "2026-11-24",
            "sources": [
                {
                    "id": "alfred",
                    "latest_vintage_date": "2026-11-20",
                    "max_age_days": 7,
                    "is_fresh": True,
                },
            ],
        }),
        encoding="utf-8",
    )
    cli.main(["check-freshness", "--status", str(fresh_path)])
    captured = capsys.readouterr()
    assert captured.out.strip() == "OK: all sources are fresh as of 2026-11-24"
    assert captured.err == ""

    stale_path = tmp_path / "stale.json"
    stale_path.write_text(
        json.dumps({
            "information_date": "2026-11-24",
            "sources": [
                {
                    "id": "alfred",
                    "latest_vintage_date": "2026-11-01",
                    "max_age_days": 7,
                    "is_fresh": False,
                },
            ],
        }),
        encoding="utf-8",
    )
    with pytest.raises(SystemExit) as stale_exc:
        cli.main(["check-freshness", "--status", str(stale_path)])
    assert stale_exc.value.code == 1
    captured = capsys.readouterr()
    assert "STALE: 1 source(s) older than allowed as of 2026-11-24" in captured.out
    assert "* alfred: latest 2026-11-01, allowed 7 days" in captured.out

    missing_path = tmp_path / "missing.json"
    with pytest.raises(SystemExit) as missing_exc:
        cli.main(["check-freshness", "--status", str(missing_path)])
    assert missing_exc.value.code == 2
    captured = capsys.readouterr()
    assert len(captured.err.strip().splitlines()) == 1

    invalid_json_path = tmp_path / "bad.json"
    invalid_json_path.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(SystemExit) as bad_exc:
        cli.main(["check-freshness", "--status", str(invalid_json_path)])
    assert bad_exc.value.code == 2
    captured = capsys.readouterr()
    assert len(captured.err.strip().splitlines()) == 1

    no_sources_path = tmp_path / "no_sources.json"
    no_sources_path.write_text(json.dumps({"information_date": "2026-11-24"}), encoding="utf-8")
    with pytest.raises(SystemExit) as no_sources_exc:
        cli.main(["check-freshness", "--status", str(no_sources_path)])
    assert no_sources_exc.value.code == 2
    captured = capsys.readouterr()
    assert len(captured.err.strip().splitlines()) == 1
