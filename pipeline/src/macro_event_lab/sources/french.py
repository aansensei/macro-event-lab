"""Kenneth R. French Data Library: daily returns of industry portfolios and the market.

Each file is a zip holding one CSV: a few lines of notes, then tables of daily returns in
percent keyed by YYYYMMDD. The library rebuilds the full history every month, so only the
newest copy of each file is used.
"""

from __future__ import annotations

import io
import re
import zipfile
from datetime import date
from pathlib import Path
from typing import Any

from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import save_raw

KIND = "french.zip"
MISSING = {-99.99, -999.0}
DATA_LINE = re.compile(r"^\s*(\d{8})\s*,(.*)$")


def ingest_file(client: RateLimitedClient, raw_dir: Path, name: str, filename: str) -> int:
    """Download one zip into the raw store. Returns its size in bytes."""
    response = client.get(f"/{filename}")
    save_raw(
        raw_dir,
        KIND,
        str(response.url),
        None,
        response.content,
        meta={"name": name, "file": filename},
        suffix=".zip",
    )
    return len(response.content)


def read_zip_csv(body: bytes) -> str:
    """The text of the one CSV inside a library zip (the files are Latin-1)."""
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        (name,) = [n for n in z.namelist() if n.lower().endswith(".csv")]
        return z.read(name).decode("latin-1")


def parse_first_table(text: str) -> list[dict[str, Any]]:
    """Long rows (portfolio, date, ret_pct) of the first table; later tables are ignored.

    A table starts at a header line beginning with a comma and ends at the first line that is
    not a dated row. In the industry files the first table holds value-weighted returns.
    """
    rows: list[dict[str, Any]] = []
    columns: list[str] | None = None
    for line in text.splitlines():
        if columns is None:
            if line.strip().startswith(","):
                columns = [c.strip() for c in line.strip().split(",")[1:]]
            continue
        match = DATA_LINE.match(line)
        if not match:
            if rows:
                break
            continue
        day = date(int(match[1][:4]), int(match[1][4:6]), int(match[1][6:]))
        for name, cell in zip(columns, match[2].split(","), strict=True):
            value = float(cell)
            ret = None if value in MISSING else value
            rows.append({"portfolio": name, "date": day, "ret_pct": ret})
    return rows
