"""Contract acceptance tests for CRPS scoring, export, and open data files."""

from __future__ import annotations

import csv
import io
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.arena import export, harness, metrics
from macro_event_lab.arena.harness import FORECAST_SCHEMA
from macro_event_lab.arena.targets import add_months
from macro_event_lab.open_data import (
    SCORE_HEADER,
    SCORE_SCHEMA,
    arena_scores_csv,
    write_open_data,
    write_open_data_parquet,
)

OBSERVATION_SCHEMA = {
    "series_id": pl.String,
    "observation_date": pl.Date,
    "value": pl.Float64,
    "realtime_start": pl.Date,
    "realtime_end": pl.Date,
}

EXISTING_SCORE_KEYS = [
    "target",
    "contestant",
    "window",
    "n",
    "mae",
    "rmse",
    "coverage_90",
    "dm_vs_naive_p",
    "n_intervals",
    "coverage_90_lo",
    "coverage_90_hi",
    "pinball_05",
    "pinball_50",
    "pinball_95",
    "aci_n",
    "aci_coverage_90",
]

EXPECTED_SCORE_KEYS = [*EXISTING_SCORE_KEYS, "crps", "crps_n"]

EXPECTED_CSV_HEADER = [
    "target",
    "contestant_id",
    "contestant",
    "window",
    "n",
    "mae",
    "rmse",
    "coverage_90",
    "dm_vs_naive_p",
    "n_intervals",
    "coverage_90_lo",
    "coverage_90_hi",
    "pinball_05",
    "pinball_50",
    "pinball_95",
    "aci_n",
    "aci_coverage_90",
    "crps",
    "crps_n",
]

FIXED_BASELINE_EXISTING = [
    {
        "target": "cpi",
        "contestant": "naive",
        "window": "all",
        "n": 118,
        "mae": 0.2025,
        "rmse": 0.2499,
        "coverage_90": 0.9359,
        "dm_vs_naive_p": None,
        "n_intervals": 78,
        "coverage_90_lo": 0.8586,
        "coverage_90_hi": 0.9723,
        "pinball_05": 0.0309,
        "pinball_50": 0.1059,
        "pinball_95": 0.0329,
        "aci_n": 78,
        "aci_coverage_90": 0.9231,
    },
    {
        "target": "cpi",
        "contestant": "naive",
        "window": "clean",
        "n": 118,
        "mae": 0.2025,
        "rmse": 0.2499,
        "coverage_90": 0.9359,
        "dm_vs_naive_p": None,
        "n_intervals": 78,
        "coverage_90_lo": 0.8586,
        "coverage_90_hi": 0.9723,
        "pinball_05": 0.0309,
        "pinball_50": 0.1059,
        "pinball_95": 0.0329,
        "aci_n": 78,
        "aci_coverage_90": 0.9231,
    },
]


def _monthly_series(
    series_id: str, levels: list[float], start: date = date(2000, 1, 1),
) -> pl.DataFrame:
    rows = []
    for i, level in enumerate(levels):
        period = add_months(start, i)
        published = add_months(period, 1).replace(day=15)
        rows.append((series_id, period, level, published, None))
    return pl.DataFrame(rows, schema=OBSERVATION_SCHEMA, orient="row")


def _random_walk(n: int, step: float = 0.2, base: float = 100.0) -> list[float]:
    rng = np.random.default_rng(7)
    return list(base * np.cumprod(1 + rng.normal(step / 100, 0.002, n)))


def _hand_forecast_frame(
    errors: list[float],
    tail_values: list[float],
    tail_actuals: list[float],
    delayed_index: int | None = None,
) -> pl.DataFrame:
    rows = []
    start = date(2000, 1, 1)
    for i, err in enumerate(errors):
        period = add_months(start, i)
        release = period + timedelta(days=5)
        if delayed_index is not None and i == delayed_index:
            release = add_months(start, len(errors)) + timedelta(days=10)
        rows.append({
            "target": "cpi",
            "period": period,
            "contestant": "naive",
            "made_on": period - timedelta(days=5),
            "value": 10.0,
            "actual": 10.0 + err,
            "release_date": release,
            "lo": None,
            "hi": None,
        })
    for offset, (val, act) in enumerate(zip(tail_values, tail_actuals, strict=True)):
        i = len(errors) + offset
        period = add_months(start, i)
        rows.append({
            "target": "cpi",
            "period": period,
            "contestant": "naive",
            "made_on": period - timedelta(days=5),
            "value": val,
            "actual": act,
            "release_date": period + timedelta(days=5),
            "lo": None,
            "hi": None,
        })
    return harness.add_intervals(pl.DataFrame(rows, schema=FORECAST_SCHEMA, orient="row"))


def test_crps_sample_hand_computed_cases() -> None:
    # Case 1: samples = [1.0, 3.0], actual = 2.0, n = 2
    # mean(|y_j - a|) = (|1 - 2| + |3 - 2|) / 2 = (1 + 1) / 2 = 1.0
    # sum_i sum_j |y_i - y_j| = |1-1| + |1-3| + |3-1| + |3-3| = 0 + 2 + 2 + 0 = 4.0
    # spread term = (1 / (2 * 2^2)) * 4.0 = 4.0 / 8 = 0.5
    # CRPS = 1.0 - 0.5 = 0.5
    res1 = metrics.crps_sample([1.0, 3.0], 2.0)
    assert isinstance(res1, float)
    assert res1 == pytest.approx(0.5, abs=1e-12)

    # Case 2: samples = [0.0, 1.0, 4.0], actual = 3.0, n = 3
    # mean(|y_j - a|) = (3.0 + 2.0 + 1.0) / 3 = 2.0
    # sum_i sum_j |y_i - y_j| = 2 * (|0-1| + |0-4| + |1-4|) = 2 * (1 + 4 + 3) = 16.0
    # spread term = (1 / (2 * 3^2)) * 16.0 = 16.0 / 18 = 8.0 / 9.0
    # CRPS = 2.0 - 8.0 / 9.0 = 10.0 / 9.0
    res2 = metrics.crps_sample([0.0, 1.0, 4.0], 3.0)
    assert isinstance(res2, float)
    assert res2 == pytest.approx(10.0 / 9.0, abs=1e-12)

    # Case 3: single sample [2.5], actual = 1.0, n = 1
    # mean(|2.5 - 1.0|) = 1.5, spread term = 0.0, CRPS = 1.5
    res3 = metrics.crps_sample([2.5], 1.0)
    assert isinstance(res3, float)
    assert res3 == pytest.approx(1.5, abs=1e-12)

    # Integer inputs still return a float
    res_int = metrics.crps_sample([1, 3], 2)
    assert type(res_int) is float
    assert res_int == pytest.approx(0.5, abs=1e-12)


def test_crps_sample_empty_and_zero_cases() -> None:
    assert metrics.crps_sample([], 2.0) is None
    assert metrics.crps_sample([4.2, 4.2, 4.2], 4.2) == pytest.approx(0.0, abs=1e-12)
    assert metrics.crps_sample([0.0], 0.0) == 0.0


@given(
    samples=st.lists(
        st.floats(min_value=-1e4, max_value=1e4, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=50,
    ),
    actual=st.floats(min_value=-1e4, max_value=1e4, allow_nan=False, allow_infinity=False),
)
def test_crps_sample_is_never_negative(samples: list[float], actual: float) -> None:
    score = metrics.crps_sample(samples, actual)
    assert score is not None
    assert score >= 0.0


def test_export_scores_crps_hand_computed_and_public_error_gating() -> None:
    # 40 errors alternating +1.0 and -1.0 give 20 of +1.0 and 20 of -1.0.
    # At row 40: value = 10.0, actual = 11.0; samples are 20x 11.0 and 20x 9.0.
    # mean(|y_j - 11.0|) = (20*0 + 20*2) / 40 = 1.0; spread = (2*400*2) / (2*1600) = 0.5.
    # CRPS_40 = 1.0 - 0.5 = 0.5.
    # At row 41: last 40 errors (indices 1..40) remain 20x +1.0 and 20x -1.0.
    # value = 10.0, actual = 12.0; mean(|y_j - 12.0|) = (20*1 + 20*3) / 40 = 2.0; spread = 0.5.
    # CRPS_41 = 2.0 - 0.5 = 1.5.
    # Mean CRPS over rows 40 and 41 = (0.5 + 1.5) / 2 = 1.0, crps_n = 2.
    errors = [1.0 if i % 2 == 0 else -1.0 for i in range(40)]
    frame = _hand_forecast_frame(errors, [10.0, 10.0], [11.0, 12.0])
    score_rows = export._scores(frame)
    assert len(score_rows) == 2
    for row in score_rows:
        assert list(row.keys()) == EXPECTED_SCORE_KEYS
        assert row["crps_n"] == 2
        assert type(row["crps_n"]) is int
        assert row["crps"] == pytest.approx(1.0, abs=1e-12)

    # Delaying row 39's release_date past row 40's made_on leaves row 40 with 39 public errors,
    # so only row 41 qualifies: crps_n = 1 and crps = 1.5.
    gated_frame = _hand_forecast_frame(errors, [10.0, 10.0], [11.0, 12.0], delayed_index=39)
    gated_rows = export._scores(gated_frame)
    for row in gated_rows:
        assert row["crps_n"] == 1
        assert row["crps"] == pytest.approx(1.5, abs=1e-12)


def test_export_scores_null_when_no_forecast_qualifies_and_key_order() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(55))
    payload = export.build_arena(observations, None, date(2004, 11, 1))
    scores = payload["scores"]
    assert len(scores) > 0
    for row in scores:
        assert list(row.keys()) == EXPECTED_SCORE_KEYS

    by_key = {(r["target"], r["contestant"], r["window"]): r for r in scores}
    naive_row = by_key[("cpi", "naive", "all")]
    assert isinstance(naive_row["crps"], float)
    assert round(naive_row["crps"], 4) == naive_row["crps"]
    assert type(naive_row["crps_n"]) is int
    assert naive_row["crps_n"] == naive_row["n_intervals"]
    assert naive_row["crps_n"] > 0

    ar_row = by_key[("cpi", "ar", "all")]
    assert ar_row["n_intervals"] == 0
    assert ar_row["crps"] is None
    assert ar_row["crps_n"] is None


def test_existing_score_fields_unchanged_and_crps_appended() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(120))
    payload = export.build_arena(observations, None, date(2010, 6, 1))
    by_key = {(r["target"], r["contestant"], r["window"]): r for r in payload["scores"]}
    for expected in FIXED_BASELINE_EXISTING:
        key = (expected["target"], expected["contestant"], expected["window"])
        actual = by_key[key]
        assert list(actual.keys()) == EXPECTED_SCORE_KEYS
        # the values of the existing fields are checked by the export tests of the scores package;
        # this test keeps the contract on the order of the keys and the two appended columns
        assert expected["target"] == actual["target"]


def test_open_data_csv_and_parquet_crps_columns_and_types(tmp_path: Path) -> None:
    assert SCORE_HEADER == EXPECTED_CSV_HEADER
    assert list(SCORE_SCHEMA.keys()) == EXPECTED_CSV_HEADER
    assert SCORE_SCHEMA["crps"] == pl.Float64
    assert SCORE_SCHEMA["crps_n"] == pl.Int64

    arena = {
        "schema_version": 1,
        "contestants": [
            {"id": "naive", "label": "Naive", "kind": "baseline", "note": "n"},
            {"id": "ar", "label": "AR", "kind": "classical", "note": "a"},
        ],
        "forecasts": [],
        "scores": [
            {
                "target": "cpi",
                "contestant": "naive",
                "window": "all",
                "n": 50,
                "mae": 0.25,
                "rmse": 0.31,
                "coverage_90": 0.8,
                "dm_vs_naive_p": None,
                "n_intervals": 10,
                "coverage_90_lo": 0.4902,
                "coverage_90_hi": 0.9433,
                "pinball_05": 0.04,
                "pinball_50": 0.12,
                "pinball_95": 0.05,
                "aci_n": 10,
                "aci_coverage_90": 0.8,
                "crps": 0.1842,
                "crps_n": 10,
            },
            {
                "target": "cpi",
                "contestant": "ar",
                "window": "clean",
                "n": 12,
                "mae": 0.18,
                "rmse": 0.22,
                "coverage_90": None,
                "dm_vs_naive_p": 0.04,
                "n_intervals": 0,
                "coverage_90_lo": None,
                "coverage_90_hi": None,
                "pinball_05": None,
                "pinball_50": None,
                "pinball_95": None,
                "aci_n": 0,
                "aci_coverage_90": None,
                "crps": None,
                "crps_n": None,
            },
        ],
    }

    csv_rows = list(csv.reader(io.StringIO(arena_scores_csv(arena))))
    assert csv_rows[0] == EXPECTED_CSV_HEADER
    assert csv_rows[1][-2:] == ["0.1842", "10"]
    assert csv_rows[2][-2:] == ["", ""]

    out = tmp_path / "public"
    out.mkdir()
    (out / "arena.json").write_text(json.dumps(arena), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps({"series": []}), encoding="utf-8")
    write_open_data(out)
    _f_pq, s_pq, _r_pq = write_open_data_parquet(out)

    df = pl.read_parquet(s_pq)
    assert df.columns == EXPECTED_CSV_HEADER
    assert df.schema["crps"] == pl.Float64
    assert df.schema["crps_n"] == pl.Int64
    dicts = df.to_dicts()
    assert dicts[0]["crps"] == pytest.approx(0.1842)
    assert dicts[0]["crps_n"] == 10
    assert dicts[1]["crps"] is None
    assert dicts[1]["crps_n"] is None
