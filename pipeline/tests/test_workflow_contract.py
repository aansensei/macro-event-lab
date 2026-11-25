"""Contract tests for the public site GitHub Actions workflow."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

WORKFLOW_PATH = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "pages.yml"

ALLOWED_ACTIONS = {
    "actions/checkout@v7",
    "actions/setup-python@v7",
    "actions/setup-node@v7",
    "actions/configure-pages@v6",
    "actions/upload-pages-artifact@v5",
    "actions/deploy-pages@v5",
}

ALLOWED_PUBLIC_DATA_FILES = {
    "revisions.json",
    "nowcast.json",
    "status.json",
    "arena.json",
    "briefing.json",
    "ledger.json",
    "calendar.ics",
    "feed.xml",
    "arena_forecasts.parquet",
    "arena_scores.parquet",
    "revisions.parquet",
    "arena_forecasts.csv",
    "arena_scores.csv",
    "revisions.csv",
}


def _strip_yaml_comment(line: str) -> str:
    in_single = False
    in_double = False
    for idx, ch in enumerate(line):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == "#" and not in_single and not in_double:
            return line[:idx]
    return line


def _parse_scalar(raw: str) -> Any:
    text = raw.strip()
    if text in {"true", "True"}:
        return True
    if text in {"false", "False"}:
        return False
    if text in {"null", "~", ""}:
        return None
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {'"', "'"}:
        return text[1:-1]
    if text.startswith("[") and text.endswith("]"):
        inner = text[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(part) for part in inner.split(",")]
    return text


def _split_key_value(content: str) -> tuple[str, str] | None:
    in_single = False
    in_double = False
    for idx, ch in enumerate(content):
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        elif ch == ":" and not in_single and not in_double and (
            idx + 1 == len(content) or content[idx + 1] == " "
        ):
            return content[:idx].strip(), content[idx + 1 :].strip()
    return None


def _parse_block_scalar(lines: list[str], start: int, parent_indent: int) -> tuple[str, int]:
    block_lines: list[str] = []
    block_indent: int | None = None
    idx = start
    while idx < len(lines):
        raw_line = lines[idx]
        if not raw_line.strip():
            block_lines.append("")
            idx += 1
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if indent <= parent_indent:
            break
        if block_indent is None:
            block_indent = indent
        block_lines.append(raw_line[block_indent:])
        idx += 1
    while block_lines and block_lines[-1] == "":
        block_lines.pop()
    return "\n".join(block_lines) + "\n", idx


def _parse_yaml_block(lines: list[str], start: int, min_indent: int) -> tuple[Any, int]:
    idx = start
    while idx < len(lines) and not _strip_yaml_comment(lines[idx]).strip():
        idx += 1
    if idx >= len(lines):
        return {}, idx
    first = _strip_yaml_comment(lines[idx])
    first_indent = len(first) - len(first.lstrip(" "))
    if first_indent < min_indent:
        return {}, idx
    if first.lstrip(" ").startswith("- "):
        return _parse_yaml_list(lines, idx, first_indent)
    return _parse_yaml_dict(lines, idx, first_indent)


def _parse_yaml_list(lines: list[str], start: int, list_indent: int) -> tuple[list[Any], int]:
    items: list[Any] = []
    idx = start
    while idx < len(lines):
        cleaned = _strip_yaml_comment(lines[idx])
        if not cleaned.strip():
            idx += 1
            continue
        indent = len(cleaned) - len(cleaned.lstrip(" "))
        if indent < list_indent:
            break
        stripped = cleaned.lstrip(" ")
        if indent != list_indent or not stripped.startswith("- "):
            break
        after_dash = stripped[2:].strip()
        kv = _split_key_value(after_dash)
        if kv is None:
            items.append(_parse_scalar(after_dash))
            idx += 1
            continue
        key, rest = kv
        item: dict[str, Any] = {}
        item_indent = list_indent + 2
        if rest in {"|", "|-"}:
            item[key], idx = _parse_block_scalar(lines, idx + 1, list_indent)
        elif rest == "":
            item[key], idx = _parse_yaml_block(lines, idx + 1, item_indent + 1)
        else:
            item[key] = _parse_scalar(rest)
            idx += 1
        while idx < len(lines):
            next_clean = _strip_yaml_comment(lines[idx])
            if not next_clean.strip():
                idx += 1
                continue
            next_indent = len(next_clean) - len(next_clean.lstrip(" "))
            if next_indent < item_indent:
                break
            if next_indent == list_indent and next_clean.lstrip(" ").startswith("- "):
                break
            extra, idx = _parse_yaml_dict(lines, idx, item_indent)
            item.update(extra)
            break
        items.append(item)
    return items, idx


def _parse_yaml_dict(lines: list[str], start: int, dict_indent: int) -> tuple[dict[str, Any], int]:
    mapping: dict[str, Any] = {}
    idx = start
    while idx < len(lines):
        cleaned = _strip_yaml_comment(lines[idx])
        if not cleaned.strip():
            idx += 1
            continue
        indent = len(cleaned) - len(cleaned.lstrip(" "))
        if indent < dict_indent:
            break
        if indent > dict_indent:
            break
        stripped = cleaned.lstrip(" ")
        if stripped.startswith("- "):
            break
        kv = _split_key_value(stripped)
        if kv is None:
            idx += 1
            continue
        key, rest = kv
        if rest in {"|", "|-"}:
            mapping[key], idx = _parse_block_scalar(lines, idx + 1, dict_indent)
        elif rest == "":
            mapping[key], idx = _parse_yaml_block(lines, idx + 1, dict_indent + 1)
        else:
            mapping[key] = _parse_scalar(rest)
            idx += 1
    return mapping, idx


def _load_workflow() -> tuple[str, dict[str, Any]]:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore[import-untyped]
    except ModuleNotFoundError:
        parsed, _ = _parse_yaml_block(text.splitlines(), 0, 0)
        assert isinstance(parsed, dict)
        return text, parsed
    loaded = yaml.safe_load(text)
    assert isinstance(loaded, dict)
    if True in loaded and "on" not in loaded:
        loaded["on"] = loaded.pop(True)
    return text, loaded


def _build_steps(workflow: dict[str, Any]) -> list[dict[str, Any]]:
    steps = workflow["jobs"]["build"]["steps"]
    assert isinstance(steps, list)
    return [step for step in steps if isinstance(step, dict)]


def _find_step(steps: list[dict[str, Any]], name: str) -> dict[str, Any]:
    for step in steps:
        if step.get("name") == name:
            return step
    raise AssertionError(f"Step {name!r} not found in build job")


def test_pages_workflow_top_level_and_job_invariants() -> None:
    _, workflow = _load_workflow()
    triggers = workflow.get("on")
    assert isinstance(triggers, dict)
    assert "pull_request_target" not in triggers
    assert triggers.get("push") == {"branches": ["main"], "paths-ignore": ["ledger/**"]}
    assert triggers.get("schedule") == [{"cron": "30 14 * * *"}]
    assert "workflow_dispatch" in triggers

    assert workflow.get("permissions") == {
        "contents": "read",
        "pages": "write",
        "id-token": "write",
    }
    assert workflow.get("concurrency") == {"group": "pages", "cancel-in-progress": False}

    jobs = workflow.get("jobs")
    assert isinstance(jobs, dict)
    assert set(jobs.keys()) == {"build", "deploy"}

    build_job = jobs["build"]
    assert build_job.get("permissions") == {
        "contents": "write",
        "pages": "write",
        "id-token": "write",
        "issues": "write",
    }

    deploy_job = jobs["deploy"]
    needs = deploy_job.get("needs")
    assert needs == "build" or needs == ["build"]
    assert "permissions" not in deploy_job


def test_pages_workflow_no_new_actions_or_secrets_and_no_printed_secrets() -> None:
    text, workflow = _load_workflow()
    jobs = workflow["jobs"]
    used_actions = {
        step["uses"]
        for job in jobs.values()
        for step in job.get("steps", [])
        if isinstance(step, dict) and "uses" in step
    }
    assert used_actions == ALLOWED_ACTIONS

    secret_refs = re.findall(r"secrets\.([A-Za-z0-9_]+)", text)
    assert secret_refs == ["FRED_API_KEY"]

    for job in jobs.values():
        for step in job.get("steps", []):
            if not isinstance(step, dict):
                continue
            run_script = str(step.get("run", ""))
            assert "secrets." not in run_script
            for line in run_script.splitlines():
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                if re.search(r"\b(echo|printf)\b", stripped):
                    assert "FRED_API_KEY" not in stripped
                    assert "GH_TOKEN" not in stripped


def test_pages_workflow_public_allowlist_unchanged() -> None:
    _, workflow = _load_workflow()
    steps = _build_steps(workflow)
    copy_step = _find_step(steps, "Copy only the public files into the site")
    run_script = str(copy_step.get("run", ""))
    copied_files = re.findall(r"MEL_DATA_DIR/web_public/([A-Za-z0-9_.-]+)", run_script)
    assert copied_files
    assert set(copied_files) == ALLOWED_PUBLIC_DATA_FILES
    assert len(copied_files) == len(ALLOWED_PUBLIC_DATA_FILES)


def test_pages_workflow_ledger_push_retries_with_backoff_and_rebase_abort() -> None:
    _, workflow = _load_workflow()
    steps = _build_steps(workflow)
    push_step = _find_step(steps, "Verify and push forecast ledger")
    run_script = str(push_step.get("run", ""))

    assert "verify-ledger" in run_script
    assert "git status --porcelain ledger/forecast_ledger.jsonl" in run_script
    assert "git add ledger/forecast_ledger.jsonl" in run_script
    assert "git commit" in run_script

    has_loop = bool(re.search(r"(?m)^\s*(for|while)\b", run_script))
    assert has_loop, "Ledger push step must use a retry loop"
    assert "git pull --rebase origin main" in run_script
    assert "git push origin HEAD:main" in run_script
    assert "git rebase --abort" in run_script

    # Loop must cap retries at 4 attempts and sleep 5, 15 and 45 seconds between attempts.
    assert re.search(r"\b4\b|\b0\s+5\s+15\s+45\b", run_script)
    for delay in ("5", "15", "45"):
        assert re.search(rf"\b{delay}\b", run_script), f"Expected backoff delay {delay}s"

    # The retry must not edit the ledger file; only verify, status and add may name it.
    ledger_lines = [
        line.strip()
        for line in run_script.splitlines()
        if "forecast_ledger.jsonl" in line and not line.strip().startswith("#")
    ]
    for line in ledger_lines:
        assert any(
            allowed in line
            for allowed in ("verify-ledger", "git status --porcelain", "git add")
        ), f"Unexpected touch of ledger file: {line}"


def test_pages_workflow_ingest_spf_records_failure_output_and_summary() -> None:
    _, workflow = _load_workflow()
    steps = _build_steps(workflow)
    ingest_step = _find_step(steps, "Download ALFRED vintages and release dates, then rebuild")

    assert ingest_step.get("id") == "ingest"
    run_script = str(ingest_step.get("run", ""))
    assert "ingest releases" in run_script
    assert "ingest alfred" in run_script
    assert "ingest spf" in run_script
    assert "build-public" in run_script

    assert "GITHUB_OUTPUT" in run_script
    assert "spf_failed=true" in run_script
    assert "spf_failed=false" in run_script
    assert "GITHUB_STEP_SUMMARY" in run_script
    lowered = run_script.lower()
    assert "survey" in lowered and "stale" in lowered and "median" in lowered


def test_pages_workflow_alert_condition_and_body_include_spf_failed() -> None:
    _, workflow = _load_workflow()
    steps = _build_steps(workflow)
    alert_step = _find_step(steps, "Alert on daily build problem")

    condition = str(alert_step.get("if", ""))
    assert "failure()" in condition
    assert "steps.fresh.outcome == 'failure'" in condition
    assert re.search(r"steps\.ingest\.outputs\.spf_failed\s*==\s*'true'", condition)

    env_block = str(alert_step.get("env", ""))
    run_script = str(alert_step.get("run", ""))
    assert "github.token" in env_block
    assert "Daily build problem" in run_script
    assert "steps.ingest.outputs.spf_failed" in env_block or (
        "steps.ingest.outputs.spf_failed" in run_script
    )
    lowered_run = run_script.lower()
    assert "survey" in lowered_run or "spf" in lowered_run
    assert "failed" in lowered_run or "stale" in lowered_run


def test_pages_workflow_close_condition_blocks_when_spf_failed() -> None:
    _, workflow = _load_workflow()
    steps = _build_steps(workflow)
    close_step = _find_step(steps, "Close resolved build issue")

    condition = str(close_step.get("if", ""))
    assert "success()" in condition
    assert "steps.fresh.outcome == 'success'" in condition
    assert re.search(
        r"steps\.ingest\.outputs\.spf_failed\s*!=\s*'true'"
        r"|!\(\s*steps\.ingest\.outputs\.spf_failed\s*==\s*'true'\s*\)",
        condition,
    )
