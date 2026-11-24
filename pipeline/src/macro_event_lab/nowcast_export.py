"""Small ALFRED-only website payload with an explicit column allowlist."""

from __future__ import annotations

from pathlib import Path

import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.web_export import SCHEMA_VERSION, _write_json

LIVE_FIELDS = ("reference_period", "as_of", "nowcast", "months_published", "missing")


def export_nowcast(
    paths: Paths, out_dir: Path | None = None, live: dict[str, object] | None = None
) -> int:
    """Export GDP forecasts and coefficients without any market-derived fields or tables.

    `live` is the nowcast for the quarter not yet released (nowcast.live_nowcast); only its
    allowlisted fields are written, and it is null when there is none.
    """
    points = pl.read_parquet(paths.gold / "gdp_nowcast.parquet").select(
        "reference_period", "release_date", "as_of", "first_print", "previous_print", "nowcast",
    ).sort("reference_period")
    coefs = pl.read_parquet(paths.gold / "gdp_nowcast_coefs.parquet").select(
        "feature", "coef", "lo", "hi",
    ).sort("feature")
    payload = {
        "schema_version": SCHEMA_VERSION, "source": "ALFRED",
        "points": [{k: v.isoformat() if hasattr(v, "isoformat") else v for k, v in row.items()}
                   for row in points.iter_rows(named=True)],
        "coefficients": coefs.to_dicts(),
        "live": None if live is None else {
            k: getattr(live[k], "isoformat", lambda v=live[k]: v)()
            for k in LIVE_FIELDS
        },
    }
    _write_json((out_dir or paths.web) / "nowcast.json", payload)
    return points.height
