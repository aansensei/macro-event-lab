from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from macro_event_lab import status_export
from macro_event_lab.config import Paths
from macro_event_lab.web_export import _write_json


def test_run_url_from_env_when_all_three_variables_are_present() -> None:
    env = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "aansensei/macro-event-lab",
        "GITHUB_RUN_ID": "123456789",
    }
    assert (
        status_export.run_url_from_env(env)
        == "https://github.com/aansensei/macro-event-lab/actions/runs/123456789"
    )


@pytest.mark.parametrize("missing", ["GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"])
def test_run_url_from_env_returns_none_when_one_variable_is_missing(missing: str) -> None:
    env = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "aansensei/macro-event-lab",
        "GITHUB_RUN_ID": "123456789",
    }
    del env[missing]
    assert status_export.run_url_from_env(env) is None


@pytest.mark.parametrize("empty_key", ["GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"])
def test_run_url_from_env_returns_none_when_one_variable_is_empty(empty_key: str) -> None:
    env = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "aansensei/macro-event-lab",
        "GITHUB_RUN_ID": "123456789",
        empty_key: "",
    }
    assert status_export.run_url_from_env(env) is None


def test_run_url_from_env_ignores_extra_variables() -> None:
    env = {
        "GITHUB_SERVER_URL": "https://github.com",
        "GITHUB_REPOSITORY": "aansensei/macro-event-lab",
        "GITHUB_RUN_ID": "987654321",
        "GITHUB_ACTOR": "octocat",
        "PATH": "/usr/bin",
    }
    assert (
        status_export.run_url_from_env(env)
        == "https://github.com/aansensei/macro-event-lab/actions/runs/987654321"
    )


def test_exported_status_json_includes_run_url_and_is_null_when_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    for key in ("GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"):
        monkeypatch.delenv(key, raising=False)
    out_file = tmp_path / "status.json"
    _write_json(out_file, status_export.build_status(Paths(tmp_path), date(2026, 11, 24)))
    payload = json.loads(out_file.read_text(encoding="utf-8"))
    assert "run_url" in payload
    assert payload["run_url"] is None

    monkeypatch.setenv("GITHUB_SERVER_URL", "https://github.com")
    monkeypatch.setenv("GITHUB_REPOSITORY", "aansensei/macro-event-lab")
    monkeypatch.setenv("GITHUB_RUN_ID", "42")
    _write_json(out_file, status_export.build_status(Paths(tmp_path), date(2026, 11, 24)))
    payload_with_url = json.loads(out_file.read_text(encoding="utf-8"))
    assert (
        payload_with_url["run_url"]
        == "https://github.com/aansensei/macro-event-lab/actions/runs/42"
    )
