"""Tests proving claims verification and test node mapping."""

from __future__ import annotations

import argparse

import pytest

from macro_event_lab.verify import (
    ClaimEntry,
    cmd_verify,
    find_claims_file,
    parse_claims,
    verify_claims,
)


def test_claims_file_parsing() -> None:
    path = find_claims_file()
    assert path.is_file()
    claims = parse_claims(path)
    assert 1 <= len(claims) <= 60
    for c in claims:
        assert c.claim_id.startswith("CLM-")
        assert len(c.claim_text) > 0
        assert len(c.command) > 0
        assert len(c.tolerance) > 0
        assert "::" in c.test_node


def test_every_claim_id_maps_to_existing_test_node() -> None:
    path = find_claims_file()
    claims = parse_claims(path)
    repo_root = path.parent
    for c in claims:
        file_part, func_part = c.test_node.split("::", 1)
        test_file = repo_root / file_part
        assert test_file.is_file(), f"Test file {file_part} for {c.claim_id} does not exist"
        content = test_file.read_text(encoding="utf-8")
        clean_func = func_part.split("[")[0]
        assert f"def {clean_func}" in content, (
            f"Test function {clean_func} not found in {file_part} for {c.claim_id}"
        )


def test_verify_runner_fails_when_test_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    # Prove that verify_claims correctly counts failures and returns non zero
    dummy_claims = [
        ClaimEntry(
            claim_id="CLM-TEST-PASS",
            claim_text="Passing test",
            command="pytest dummy",
            tolerance="exact",
            test_node="pipeline/tests/test_pit.py::test_known_from_uses_release_time_or_end_of_day",
        ),
        ClaimEntry(
            claim_id="CLM-TEST-FAIL",
            claim_text="Failing test",
            command="pytest dummy",
            tolerance="exact",
            test_node="pipeline/tests/test_pit.py::test_non_existent_function",
        ),
    ]

    def mock_run(test_node: str, *args, **kwargs) -> bool:
        return "test_non_existent_function" not in test_node

    monkeypatch.setattr("macro_event_lab.verify.run_claim_test", mock_run)
    passed, failed = verify_claims(dummy_claims)
    assert passed == 1
    assert failed == 1

    # Verify cmd_verify exits non zero on failure
    monkeypatch.setattr(
        "macro_event_lab.verify.parse_claims",
        lambda _path: dummy_claims,
    )
    args = argparse.Namespace(claims_file=None)
    with pytest.raises(SystemExit) as exc:
        cmd_verify(args)
    assert exc.value.code != 0
