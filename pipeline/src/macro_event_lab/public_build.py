"""Public edition build: tables and website files from ALFRED alone, never from Kalshi.

The public website shows revisions and the GDP nowcast. Both come from ALFRED vintages, which
are public US government data, so this build can run on a schedule anywhere (a CI runner has no
Kalshi archive at all) and its output folder can be published as it is.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import polars as pl

from macro_event_lab.arena.export import write_arena
from macro_event_lab.build import build_silver
from macro_event_lab.config import Paths
from macro_event_lab.gold import revisions
from macro_event_lab.nowcast import coefficient_table, live_nowcast, nowcast_rows, walk_forward
from macro_event_lab.nowcast_export import export_nowcast
from macro_event_lab.status_export import build_status
from macro_event_lab.web_export import _write_json, revisions_payload

# the only files the public website reads; anything else in the folder is a mistake
PUBLIC_FILES = ("revisions.json", "nowcast.json", "status.json", "arena.json")


def public_dir(paths: Paths) -> Path:
    return paths.root / "web_public"


def build_public(paths: Paths, today: date | None = None) -> dict[str, int]:
    """Rebuild silver, the ALFRED gold tables and the public website files.

    Returns row counts. `today` sets the information date of the live nowcast.
    """
    build_silver(paths)
    observations = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    paths.gold.mkdir(parents=True, exist_ok=True)
    rev = revisions(observations)
    rows = nowcast_rows(observations)
    tables = {
        "revisions": rev,
        "gdp_nowcast": walk_forward(rows),
        "gdp_nowcast_coefs": coefficient_table(rows),
    }
    for name, df in tables.items():
        df.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    out = public_dir(paths)
    _write_json(out / "revisions.json", revisions_payload(rev))
    live = live_nowcast(observations, today or date.today())
    export_nowcast(paths, out_dir=out, live=live)
    information_date = today or date.today()
    write_arena(paths, information_date, out_dir=out)
    _write_json(out / "status.json", build_status(paths, information_date))
    return {name: df.height for name, df in tables.items()} | {"live": int(live is not None)}
