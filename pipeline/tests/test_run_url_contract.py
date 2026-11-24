from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from types import MappingProxyType

import pytest

from macro_event_lab import status_export
from macro_event_lab.config import Paths

FULL_ENV = {
    "GITHUB_SERVER_URL": "https://github.com",
    "GITHUB_REPOSITORY": "aansensei/macro-event-lab",
    "GITHUB_RUN_ID": "123456789",
}
EXPECTED_URL = "https://github.com/aansensei/macro-event-lab/actions/runs/123456789"


def test_run_url_from_env_builds_exact_url_from_three_variables() -> None:
    assert status_export.run_url_from_env(dict(FULL_ENV)) == EXPECTED_URL


def test_run_url_from_env_accepts_readonly_mapping_and_ignores_extra_variables() -> None:
    env = MappingProxyType({
        **FULL_ENV,
        "CI": "true",
        "GITHUB_WORKFLOW": "pages.yml",
        "EXTRA_VAR": "ignored",
    })
    assert status_export.run_url_from_env(env) == EXPECTED_URL


@pytest.mark.parametrize(
    "missing_key",
    ["GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"],
)
def test_run_url_from_env_returns_none_when_variable_is_missing(missing_key: str) -> None:
    env = {k: v for k, v in FULL_ENV.items() if k != missing_key}
    assert status_export.run_url_from_env(env) is None


def test_run_url_from_env_returns_none_for_empty_mapping() -> None:
    assert status_export.run_url_from_env({}) is None


@pytest.mark.parametrize(
    "empty_key",
    ["GITHUB_SERVER_URL", "GITHUB_REPOSITORY", "GITHUB_RUN_ID"],
)
def test_run_url_from_env_returns_none_when_variable_is_empty(empty_key: str) -> None:
    env = dict(FULL_ENV)
    env[empty_key] = ""
    assert status_export.run_url_from_env(env) is None


def test_build_status_writes_run_url_from_os_environ_and_keeps_existing_keys(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    for key, value in FULL_ENV.items():
        monkeypatch.setenv(key, value)
    monkeypatch.setenv("EXTRA_STATUS_ENV", "ignored")

    with_env = status_export.build_status(Paths(tmp_path), date(2026, 11, 24))
    assert set(with_env) == {
        "schema_version",
        "generated_at",
        "information_date",
        "run_url",
        "sources",
        "checks",
    }
    assert with_env["run_url"] == EXPECTED_URL

    for key in FULL_ENV:
        monkeypatch.delenv(key, raising=False)

    without_env = status_export.build_status(Paths(tmp_path), date(2026, 11, 24))
    assert set(without_env) == set(with_env)
    assert without_env["run_url"] is None
    assert json.loads(json.dumps(without_env))["run_url"] is None
