"""Bronze layer: every API response is saved as-is before any parsing.

Files are content-addressed (named by the SHA-256 of the body), so re-running an ingest
never duplicates a file. A manifest (JSON Lines) records what was fetched, when, and from
where, which lets `build` re-parse everything from scratch at any time.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SECRET_PARAMS = {"api_key", "apikey", "token"}


@dataclass(frozen=True)
class RawRecord:
    kind: str  # e.g. "alfred.observations", "kalshi.candles"
    url: str
    params: dict[str, Any]
    fetched_at_utc: str
    sha256: str
    path: str  # relative to the raw directory
    meta: dict[str, Any] = field(default_factory=dict)


def redact(params: dict[str, Any] | None) -> dict[str, Any]:
    """Never write API keys to disk."""
    return {k: ("***" if k.lower() in SECRET_PARAMS else v) for k, v in (params or {}).items()}


def save_raw(
    raw_dir: Path,
    kind: str,
    url: str,
    params: dict[str, Any] | None,
    body: bytes,
    meta: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> RawRecord:
    now = now or datetime.now(UTC)
    digest = hashlib.sha256(body).hexdigest()
    source = kind.split(".", 1)[0]
    rel_path = Path(source) / now.strftime("%Y-%m-%d") / f"{digest}.json.gz"
    full_path = raw_dir / rel_path
    if not full_path.exists():
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(gzip.compress(body))

    record = RawRecord(
        kind=kind,
        url=url,
        params=redact(params),
        fetched_at_utc=now.isoformat(),
        sha256=digest,
        path=rel_path.as_posix(),
        meta=meta or {},
    )
    manifest = raw_dir / "_manifest.jsonl"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    with manifest.open("a", encoding="utf-8") as f:
        f.write(json.dumps(asdict(record)) + "\n")
    return record


def iter_manifest(raw_dir: Path):
    manifest = raw_dir / "_manifest.jsonl"
    if not manifest.exists():
        return
    with manifest.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield RawRecord(**json.loads(line))


def load_raw(raw_dir: Path, record: RawRecord) -> Any:
    return json.loads(gzip.decompress((raw_dir / record.path).read_bytes()))
