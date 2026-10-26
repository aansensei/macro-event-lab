import json
from datetime import UTC, datetime

import polars as pl

from macro_event_lab.build import build_silver
from macro_event_lab.config import Paths
from macro_event_lab.raw_store import save_raw


def _alfred(value: str) -> bytes:
    return json.dumps({"count": 1, "observations": [{
        "realtime_start": "2026-09-11", "realtime_end": "9999-12-31",
        "date": "2026-08-01", "value": value,
    }]}).encode()


def test_build_is_idempotent_and_keeps_latest_fetch(tmp_path):
    paths = Paths(tmp_path)
    t1 = datetime(2026, 10, 1, tzinfo=UTC)
    t2 = datetime(2026, 10, 2, tzinfo=UTC)
    meta = {"series_id": "CPIAUCSL"}
    save_raw(paths.raw, "alfred.observations", "u", {}, _alfred("320.1"), meta, t1)
    save_raw(paths.raw, "alfred.observations", "u", {}, _alfred("320.2"), meta, t2)

    first = build_silver(paths)
    df1 = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    second = build_silver(paths)
    df2 = pl.read_parquet(paths.silver / "alfred_observations.parquet")

    assert first == second
    assert df1.equals(df2)
    assert df1.height == 1
    assert df1["value"][0] == 320.2  # the later fetch wins
