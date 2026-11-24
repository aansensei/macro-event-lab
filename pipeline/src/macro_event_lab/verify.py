"""Verification runner for public claims documented in CLAIMS.md."""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ClaimEntry:
    claim_id: str
    claim_text: str
    command: str
    tolerance: str
    test_node: str


def find_claims_file(explicit_path: str | Path | None = None) -> Path:
    if explicit_path:
        p = Path(explicit_path)
        if p.is_file():
            return p
        raise FileNotFoundError(f"Claims file not found at {explicit_path}")

    candidates = [
        Path.cwd() / "CLAIMS.md",
        Path(__file__).resolve().parents[3] / "CLAIMS.md",
    ]
    for c in candidates:
        if c.is_file():
            return c
    raise FileNotFoundError("CLAIMS.md not found in repository root")


def parse_claims(claims_path: Path) -> list[ClaimEntry]:
    entries: list[ClaimEntry] = []
    content = claims_path.read_text(encoding="utf-8")
    for line in content.splitlines():
        line = line.strip()
        if not line.startswith("|") or "---" in line or line.startswith("| ID"):
            continue
        parts = [p.strip() for p in line.split("|")]
        parts = [p for p in parts if p]
        if len(parts) >= 5:
            cid = parts[0]
            claim_text = parts[1]
            cmd = parts[2].strip("`")
            tol = parts[3]
            node = parts[4].strip("`")
            if cid.startswith("CLM-"):
                entries.append(
                    ClaimEntry(
                        claim_id=cid,
                        claim_text=claim_text,
                        command=cmd,
                        tolerance=tol,
                        test_node=node,
                    )
                )
    return entries


def run_claim_test(
    test_node: str,
    python_exe: str | None = None,
    repo_root: Path | None = None,
) -> bool:
    py = python_exe or sys.executable
    cmd = [py, "-m", "pytest", test_node, "-q"]
    proc = subprocess.run(cmd, cwd=repo_root, capture_output=True, text=True)
    return proc.returncode == 0


def verify_claims(
    claims: list[ClaimEntry],
    python_exe: str | None = None,
    repo_root: Path | None = None,
    output_stream=None,
) -> tuple[int, int]:
    out = output_stream or sys.stdout
    passed = 0
    failed = 0
    for c in claims:
        ok = run_claim_test(c.test_node, python_exe=python_exe, repo_root=repo_root)
        if ok:
            passed += 1
            out.write(f"PASS {c.claim_id}: {c.test_node}\n")
        else:
            failed += 1
            out.write(f"FAIL {c.claim_id}: {c.test_node}\n")
        out.flush()
    return passed, failed


def cmd_verify(args: argparse.Namespace) -> None:
    path = find_claims_file(getattr(args, "claims_file", None))
    claims = parse_claims(path)
    if not claims:
        print(f"No claims found in {path}")
        sys.exit(1)

    repo_root = path.parent
    print(f"Verifying {len(claims)} claims from {path.name}:")
    passed, failed = verify_claims(claims, repo_root=repo_root)
    print(f"\nResult: {passed} passed, {failed} failed out of {len(claims)} claims.")
    if failed > 0:
        sys.exit(1)
