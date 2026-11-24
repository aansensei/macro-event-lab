import json
from datetime import date

import polars as pl

from macro_event_lab.config import Paths
from macro_event_lab.nowcast_export import export_nowcast


def test_nowcast_export_is_deterministic_and_excludes_all_nonallowlisted_fields(tmp_path):
    paths = Paths(tmp_path)
    paths.gold.mkdir()
    pl.DataFrame({
        "reference_period": [date(2025, 1, 1)], "release_date": [date(2025, 4, 30)],
        "as_of": [date(2025, 4, 29)], "first_print": [2.0], "previous_print": [1.0],
        "nowcast": [1.5], "market_comparison": [999.0],
    }).write_parquet(paths.gold / "gdp_nowcast.parquet")
    coefficients = pl.DataFrame({"feature": ["INDPRO"], "coef": [0.3], "lo": [0.1], "hi": [0.5],
                                 "private_field": ["excluded"]})
    coefficients.write_parquet(paths.gold / "gdp_nowcast_coefs.parquet")
    assert export_nowcast(paths) == 1
    first = (paths.web / "nowcast.json").read_bytes()
    export_nowcast(paths)
    assert (paths.web / "nowcast.json").read_bytes() == first
    data = json.loads(first)
    assert data["source"] == "ALFRED"
    assert set(data["points"][0]) == {
        "reference_period", "release_date", "as_of", "first_print", "previous_print", "nowcast",
    }
    assert set(data["coefficients"][0]) == {"feature", "coef", "lo", "hi"}
    assert data["points"][0]["as_of"] == "2025-04-29"


def test_nowcast_export_writes_only_the_allowlisted_live_fields(tmp_path):
    paths = Paths(tmp_path)
    paths.gold.mkdir()
    pl.DataFrame({
        "reference_period": [date(2025, 1, 1)], "release_date": [date(2025, 4, 30)],
        "as_of": [date(2025, 4, 29)], "first_print": [2.0], "previous_print": [1.0],
        "nowcast": [1.5],
    }).write_parquet(paths.gold / "gdp_nowcast.parquet")
    pl.DataFrame({"feature": ["INDPRO"], "coef": [0.3], "lo": [0.1], "hi": [0.5]}).write_parquet(
        paths.gold / "gdp_nowcast_coefs.parquet"
    )
    live = {"reference_period": date(2025, 4, 1), "as_of": date(2025, 6, 2), "nowcast": 2.4,
            "lam": 10.0, "n_train": 90, "months_published": 2, "missing": ["PCEC96"]}

    export_nowcast(paths, out_dir=tmp_path / "public", live=live)

    data = json.loads((tmp_path / "public" / "nowcast.json").read_text(encoding="utf-8"))
    assert data["live"] == {"reference_period": "2025-04-01", "as_of": "2025-06-02",
                            "nowcast": 2.4, "months_published": 2, "missing": ["PCEC96"]}
