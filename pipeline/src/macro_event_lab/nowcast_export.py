"""Small ALFRED-only website payload with an explicit column allowlist."""

from __future__ import annotations

import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.web_export import SCHEMA_VERSION, _write_json


def export_nowcast(paths: Paths) -> int:
    """Export GDP forecasts and coefficients without any market-derived fields or tables."""
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
    }
    _write_json(paths.web / "nowcast.json", payload)
    return points.height
