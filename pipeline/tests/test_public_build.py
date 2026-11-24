import json
from datetime import date

import polars as pl

from macro_event_lab import public_build
from macro_event_lab.config import Paths

OBS_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}


def test_public_build_writes_only_the_public_files(tmp_path, monkeypatch):
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    d = date
    pl.DataFrame(
        [
            ("PAYEMS", d(2025, 1, 1), 1000.0, d(2025, 2, 7), None),
            ("PAYEMS", d(2025, 2, 1), 1100.0, d(2025, 3, 7), None),
        ],
        schema=OBS_SCHEMA, orient="row",
    ).write_parquet(paths.silver / "alfred_observations.parquet")
    # silver is already in place; the real build_silver would parse the raw archive
    monkeypatch.setattr(public_build, "build_silver", lambda _: {})

    counts = public_build.build_public(paths, today=d(2025, 3, 10))

    out = public_build.public_dir(paths)
    assert sorted(p.name for p in out.iterdir()) == sorted(public_build.PUBLIC_FILES)
    assert counts["revisions"] == 1 and counts["live"] == 0
    nowcast = json.loads((out / "nowcast.json").read_text(encoding="utf-8"))
    assert nowcast["source"] == "ALFRED"
    assert nowcast["live"] is None
    status = json.loads((out / "status.json").read_text(encoding="utf-8"))
    assert status["information_date"] == "2025-03-10"
    assert status["sources"][0]["rows"] == 2
    assert status["sources"][0]["is_fresh"] is True
    assert {check["name"] for check in status["checks"]} == {
        "duplicates_alfred_observations", "missing_observations",
    }
    revisions = json.loads((out / "revisions.json").read_text(encoding="utf-8"))
    assert [s["series"] for s in revisions["series"]] == ["payrolls"]
    for path in out.rglob("*"):
        if path.is_file():
            content = path.read_text(encoding="utf-8").lower()
            assert "kx" not in content
            assert "kalshi" not in content
