"""Static checks for the GitHub Pages daily workflow."""

from __future__ import annotations

import re
from pathlib import Path

from macro_event_lab import public_build

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "pages.yml"
PUBLIC_ASSETS_PATH = REPO_ROOT / "web" / "scripts" / "publicAssets.ts"


def _strip_comment(line: str) -> str:
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


def _extract_job_block(text: str, job_name: str) -> str:
    lines = text.splitlines()
    start_idx: int | None = None
    for idx, line in enumerate(lines):
        if re.match(rf"^  {re.escape(job_name)}:\s*(#.*)?$", line):
            start_idx = idx
            break
    if start_idx is None:
        return ""
    end_idx = len(lines)
    for idx in range(start_idx + 1, len(lines)):
        if re.match(r"^  [A-Za-z0-9_-]+:\s*(#.*)?$", lines[idx]) or re.match(r"^\S", lines[idx]):
            end_idx = idx
            break
    return "\n".join(lines[start_idx:end_idx])


def _split_steps(job_block: str) -> list[str]:
    lines = job_block.splitlines()
    steps_idx: int | None = None
    for idx, line in enumerate(lines):
        if re.match(r"^    steps:\s*(#.*)?$", line):
            steps_idx = idx
            break
    if steps_idx is None:
        return []
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in lines[steps_idx + 1 :]:
        if re.match(r"^    [A-Za-z0-9_-]+:\s*", line):
            break
        if re.match(r"^      -\s+", line):
            if current:
                blocks.append(current)
            current = [line]
        elif current:
            current.append(line)
    if current:
        blocks.append(current)
    return ["\n".join(block) for block in blocks]


def _find_step(steps: list[str], name: str) -> str:
    for step in steps:
        if re.search(rf"(?m)^\s*-\s*name:\s*{re.escape(name)}\s*$", step):
            return step
    raise AssertionError(f"Step not found: {name}")


def _extract_if_line(step: str) -> str:
    match = re.search(r"(?m)^\s*(?:-\s*)?if:\s*(.+?)\s*$", step)
    assert match is not None, f"Missing if condition in step:\n{step}"
    return match.group(1)


def _public_assets_allowlist() -> set[str]:
    text = PUBLIC_ASSETS_PATH.read_text(encoding="utf-8")
    match = re.search(r"export const PUBLIC_DATA_FILES = \[(.*?)\] as const;", text, re.DOTALL)
    assert match is not None
    return set(re.findall(r'"([^"]+)"', match.group(1)))


def test_ledger_push_step_retries_four_times_and_aborts_conflicted_rebase() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    ledger_step = _find_step(steps, "Verify and push forecast ledger")

    assert "for attempt in 1 2 3 4" in ledger_step
    assert "5 15 45" in ledger_step
    assert "git pull --rebase origin main" in ledger_step
    assert "git push origin HEAD:main" in ledger_step
    assert "git rebase --abort" in ledger_step
    assert ledger_step.count("ledger/forecast_ledger.jsonl") == 3


def test_ingest_step_records_spf_failure_and_keeps_building() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    ingest_step = _find_step(steps, "Download ALFRED vintages and release dates, then rebuild")

    assert re.search(r"(?m)^\s*(?:-\s*)?id:\s*ingest\s*$", ingest_step)
    assert "spf_failed=true" in ingest_step
    assert "spf_failed=false" in ingest_step
    assert "GITHUB_OUTPUT" in ingest_step
    assert "GITHUB_STEP_SUMMARY" in ingest_step
    assert "survey median is stale" in ingest_step.lower()
    assert "python -m macro_event_lab build-public" in ingest_step


def test_ingest_step_records_yields_failure_and_keeps_building() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    ingest_step = _find_step(steps, "Download ALFRED vintages and release dates, then rebuild")

    assert "python -m macro_event_lab ingest yields" in ingest_step
    assert "yields_failed=true" in ingest_step
    assert "yields_failed=false" in ingest_step
    assert "yield" in ingest_step.lower()


def test_alert_and_close_conditions_check_spf_failed_output() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))

    alert_step = _find_step(steps, "Alert on daily build problem")
    alert_if = _extract_if_line(alert_step)
    assert "failure()" in alert_if
    assert "steps.fresh.outcome == 'failure'" in alert_if
    assert "steps.ingest.outputs.spf_failed == 'true'" in alert_if
    assert "steps.ingest.outputs.yields_failed == 'true'" in alert_if
    assert "steps.ingest.outputs.spf_failed" in alert_step
    assert "steps.ingest.outputs.yields_failed" in alert_step
    assert "survey" in alert_step.lower()
    assert "yield" in alert_step.lower()

    close_step = _find_step(steps, "Close resolved build issue")
    close_if = _extract_if_line(close_step)
    assert "success()" in close_if
    assert "steps.fresh.outcome == 'success'" in close_if
    assert "steps.ingest.outputs.spf_failed != 'true'" in close_if
    assert "steps.ingest.outputs.yields_failed != 'true'" in close_if


def test_only_allowlisted_public_files_are_copied_to_site() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    copy_step = _find_step(steps, "Copy only the public files into the site")

    assert "*" not in copy_step
    assert "?" not in copy_step
    copied = set(re.findall(r"\$MEL_DATA_DIR/web_public/([^\s\"']+)", copy_step))
    allowed = set(public_build.PUBLIC_FILES) | {
        "ledger.json", "ledger_track.json", "reactions.json",
    }
    assert copied
    assert copied <= allowed
    if PUBLIC_ASSETS_PATH.is_file():
        assert copied == _public_assets_allowlist()


def test_no_step_prints_a_secret_and_contents_write_is_only_on_build() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    clean_lines = [_strip_comment(line) for line in text.splitlines()]
    clean_text = "\n".join(clean_lines)

    for line in clean_lines:
        if "secrets." in line:
            assert not re.search(r"\b(echo|printf|cat|print)\b", line, re.IGNORECASE)
            assert "FRED_API_KEY:" in line

    build_block = _extract_job_block(clean_text, "build")
    deploy_block = _extract_job_block(clean_text, "deploy")
    top_level = clean_text.split("\njobs:", 1)[0]

    assert "write-all" not in clean_text
    assert re.search(r"(?m)^\s*contents:\s*read\b", top_level)
    assert not re.search(r"(?m)^\s*contents:\s*write\b", top_level)
    assert re.search(r"(?m)^\s*contents:\s*write\b", build_block)
    assert not re.search(r"(?m)^\s*contents:\s*write\b", deploy_block)


def test_a_push_that_changes_only_the_site_reuses_the_published_data() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    mode_step = _find_step(steps, "Choose a full rebuild or reuse the published data")
    assert re.search(r"(?m)^\s*id:\s*mode\s*$", mode_step)
    # a change under the pipeline, the workflows, the ledger or the container rebuilds everything
    assert r"^(pipeline/|\.github/|ledger/|Dockerfile)" in mode_step
    assert 'echo "full=$full" >> "$GITHUB_OUTPUT"' in mode_step
    # the files fetched from the published site are exactly the public data allowlist
    fetched = set(re.search(r"for name in ([^;]+); do", mode_step).group(1).split())
    optional_match = re.search(r"for optional in ([^;]+); do", mode_step)
    optional_fetched = set(optional_match.group(1).split()) if optional_match else set()
    assert fetched <= _public_assets_allowlist()
    assert optional_fetched == {"reactions.json"}
    assert optional_fetched <= _public_assets_allowlist()
    copy_step = _find_step(steps, "Copy only the public files into the site")
    copied = set(re.findall(r"web_public/([A-Za-z0-9_.]+)", copy_step))
    assert (fetched | optional_fetched) == copied


def test_reactions_step_builds_when_yield_table_exists() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    reactions_step = _find_step(steps, "Build release reactions for the site")
    assert "if: steps.mode.outputs.full == 'true'" in reactions_step
    assert "macro_event_lab reactions --yields-from" in reactions_step
    assert "$MEL_DATA_DIR/web_public/reactions.json" in reactions_step


def test_every_heavy_step_runs_only_on_a_full_rebuild() -> None:
    text = WORKFLOW_PATH.read_text(encoding="utf-8")
    steps = _split_steps(_extract_job_block(text, "build"))
    for name in (
        "Download ALFRED vintages and release dates, then rebuild",
        "Build release reactions for the site",
        "Append live forecasts to ledger",
        "Verify and push forecast ledger",
        "Summarize the forecast ledger for the site",
        "Check source freshness",
        "Copy only the public files into the site",
    ):
        assert "if: steps.mode.outputs.full == 'true'" in _find_step(steps, name), name
    # the site build and the deploy always run
    for step in steps:
        if "npm run build" in step or "upload-pages-artifact" in step:
            assert "steps.mode.outputs.full" not in step
