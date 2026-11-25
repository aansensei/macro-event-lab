from datetime import date

import polars as pl
import pytest

from macro_event_lab.arena.export import _regimes
from macro_event_lab.arena.harness import FORECAST_SCHEMA


def points(year, model, errors):
    return [{"target": "cpi", "contestant": model, "period": date(year, m, 1),
             "made_on": date(year, m, 1), "release_date": date(year, m, 2),
             "actual": 0.0, "value": e, "lo": None, "hi": None}
            for m, e in enumerate(errors, 1)]


def test_regimes_match_baseline_periods_and_suppress_small_samples():
    rows = points(2020, "naive", [2, 2, 2, 2, 100]) + points(2020, "ridge", [1, 1, 1, 1])
    rows += points(2019, "ar", [1, 2, 3]) + points(2026, "ar", [1, 2, 3, 4])
    result = _regimes(pl.DataFrame(rows, schema=FORECAST_SCHEMA))
    ridge = next(r for r in result if r["contestant"] == "ridge")
    assert ridge == {"target": "cpi", "contestant": "ridge", "regime": "2020", "n": 4,
                     "rmse": 1.0, "mae": 1.0, "naive_rmse": 2.0, "vs_naive_pct": -50.0}
    ar = [r for r in result if r["contestant"] == "ar"]
    assert ar[0]["n"] == 3 and ar[0]["rmse"] is None and ar[0]["mae"] is None
    assert ar[1]["regime"] == "2024_on" and ar[1]["naive_rmse"] is None
    assert ar[1]["rmse"] == round((30 / 4) ** 0.5, 4)
    assert sum(r["n"] for r in result) == len(rows)
    assert [r["contestant"] for r in result] == ["naive", "ar", "ar", "ridge"]


@pytest.mark.parametrize("baseline", [[0, 0, 0, 0], [1, 1, 1]])
def test_zero_or_incomplete_baseline_has_no_relative_score(baseline):
    result = _regimes(pl.DataFrame(points(2024, "naive", baseline)
                                  + points(2024, "ar", [1, 1, 1, 1]), schema=FORECAST_SCHEMA))
    assert next(r for r in result if r["contestant"] == "ar")["vs_naive_pct"] is None


def test_computation_uses_unrounded_values_and_empty_frames():
    result = _regimes(pl.DataFrame(points(2000, "naive", [0.00014] * 4)
                                  + points(2000, "ar", [0.00011] * 4), schema=FORECAST_SCHEMA))
    assert result[1]["vs_naive_pct"] == -21.4286
    assert _regimes(pl.DataFrame(schema=FORECAST_SCHEMA)) == []
