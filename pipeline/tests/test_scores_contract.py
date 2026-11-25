from __future__ import annotations

import csv
import io
import json
from datetime import date
from pathlib import Path

import numpy as np
import polars as pl
import pytest

from macro_event_lab.arena import conformal, export, harness, metrics
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
]

NEW_SCORE_KEYS = [
    "n_intervals",
    "coverage_90_lo",
    "coverage_90_hi",
    "pinball_05",
    "pinball_50",
    "pinball_95",
    "aci_n",
    "aci_coverage_90",
]

EXPECTED_SCORE_KEYS = EXISTING_SCORE_KEYS + NEW_SCORE_KEYS

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
]

FIXED_FIXTURE_BASELINE = [
    {
        "target": "cpi",
        "contestant": "naive",
        "window": "all",
        "n": 118,
        "mae": 0.2025,
        "rmse": 0.2499,
        "coverage_90": 0.9359,
        "dm_vs_naive_p": None,
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
    },
    {
        "target": "cpi",
        "contestant": "ar",
        "window": "all",
        "n": 99,
        "mae": 0.1432,
        "rmse": 0.1798,
        "coverage_90": 0.9322,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "ar",
        "window": "clean",
        "n": 99,
        "mae": 0.1432,
        "rmse": 0.1798,
        "coverage_90": 0.9322,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "ridge",
        "window": "all",
        "n": 98,
        "mae": 0.1415,
        "rmse": 0.1779,
        "coverage_90": 0.931,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "ridge",
        "window": "clean",
        "n": 98,
        "mae": 0.1415,
        "rmse": 0.1779,
        "coverage_90": 0.931,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "factor_ridge",
        "window": "all",
        "n": 98,
        "mae": 0.1424,
        "rmse": 0.1784,
        "coverage_90": 0.9138,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "factor_ridge",
        "window": "clean",
        "n": 98,
        "mae": 0.1424,
        "rmse": 0.1784,
        "coverage_90": 0.9138,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "lasso",
        "window": "all",
        "n": 98,
        "mae": 0.1415,
        "rmse": 0.1792,
        "coverage_90": 0.931,
        "dm_vs_naive_p": 0.0,
    },
    {
        "target": "cpi",
        "contestant": "lasso",
        "window": "clean",
        "n": 98,
        "mae": 0.1415,
        "rmse": 0.1792,
        "coverage_90": 0.931,
        "dm_vs_naive_p": 0.0,
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


def test_scores_field_names_and_order() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(52))
    payload = export.build_arena(observations, None, date(2004, 8, 1))
    assert payload["schema_version"] == 1
    assert len(payload["scores"]) > 0
    for row in payload["scores"]:
        assert list(row.keys()) == EXPECTED_SCORE_KEYS


def test_scores_values_rounding_and_null_rules() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(55))
    as_of = date(2004, 11, 1)
    payload = export.build_arena(observations, None, as_of)
    targets = export.first_print_targets(observations)
    origins = export.build_origins(targets, None)
    forecasts = harness.run_walk_forward(observations, None, targets, origins)

    by_key = {(r["target"], r["contestant"], r["window"]): r for r in payload["scores"]}

    naive_row = by_key[("cpi", "naive", "all")]
    assert type(naive_row["n_intervals"]) is int
    assert type(naive_row["aci_n"]) is int
    assert naive_row["n_intervals"] > 0
    assert naive_row["aci_n"] > 0

    naive_df = forecasts.filter(
        (pl.col("target") == "cpi") & (pl.col("contestant") == "naive")
    ).sort("period")
    covered_df = naive_df.drop_nulls(["lo", "hi"])
    actuals = covered_df["actual"].to_list()
    lows = covered_df["lo"].to_list()
    highs = covered_df["hi"].to_list()
    values = covered_df["value"].to_list()
    hits = sum(lo <= y <= hi for y, lo, hi in zip(actuals, lows, highs, strict=True))
    w_lo, w_hi = metrics.wilson_interval(hits, len(actuals))
    errors = [r["actual"] - r["value"] for r in naive_df.iter_rows(named=True)]
    aci = conformal.aci_coverage(errors)

    assert naive_row["n_intervals"] == len(actuals)
    assert naive_row["coverage_90_lo"] == round(w_lo, 4)
    assert naive_row["coverage_90_hi"] == round(w_hi, 4)
    assert naive_row["pinball_05"] == round(metrics.pinball_loss(actuals, lows, 0.05), 4)
    assert naive_row["pinball_50"] == round(metrics.pinball_loss(actuals, values, 0.5), 4)
    assert naive_row["pinball_95"] == round(metrics.pinball_loss(actuals, highs, 0.95), 4)
    assert naive_row["aci_n"] == aci["n"]
    assert naive_row["aci_coverage_90"] == round(aci["coverage"], 4)

    float_keys = (
        "coverage_90_lo",
        "coverage_90_hi",
        "pinball_05",
        "pinball_50",
        "pinball_95",
        "aci_coverage_90",
    )
    for key in float_keys:
        val = naive_row[key]
        assert isinstance(val, float)
        assert round(val, 4) == val

    ar_row = by_key[("cpi", "ar", "all")]
    assert ar_row["n"] < 40
    assert ar_row["n_intervals"] == 0
    assert type(ar_row["n_intervals"]) is int
    assert ar_row["coverage_90_lo"] is None
    assert ar_row["coverage_90_hi"] is None
    assert ar_row["pinball_05"] is None
    assert ar_row["pinball_50"] is None
    assert ar_row["pinball_95"] is None
    assert ar_row["aci_n"] == 0
    assert type(ar_row["aci_n"]) is int
    assert ar_row["aci_coverage_90"] is None


def test_existing_score_fields_unchanged_against_fixed_fixture() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(120))
    payload = export.build_arena(observations, None, date(2010, 6, 1))
    scores = payload["scores"]
    assert len(scores) == len(FIXED_FIXTURE_BASELINE)
    for actual_row, expected_row in zip(scores, FIXED_FIXTURE_BASELINE, strict=True):
        assert list(actual_row.keys()) == EXPECTED_SCORE_KEYS
        for key in EXISTING_SCORE_KEYS:
            assert actual_row[key] == expected_row[key]


def test_arena_scores_csv_and_parquet_new_columns_and_types(tmp_path: Path) -> None:
    assert SCORE_HEADER == EXPECTED_CSV_HEADER
    assert list(SCORE_SCHEMA.keys()) == EXPECTED_CSV_HEADER
    assert SCORE_SCHEMA["n"] == pl.Int64
    assert SCORE_SCHEMA["n_intervals"] == pl.Int64
    assert SCORE_SCHEMA["aci_n"] == pl.Int64
    for col in (
        "coverage_90_lo",
        "coverage_90_hi",
        "pinball_05",
        "pinball_50",
        "pinball_95",
        "aci_coverage_90",
    ):
        assert SCORE_SCHEMA[col] == pl.Float64

    arena = {
        "schema_version": 1,
        "contestants": [
            {"id": "naive", "label": "Naive", "kind": "baseline", "note": "n"},
            {"id": "ar", "label": "AR, lag 1", "kind": "classical", "note": "a"},
        ],
        "forecasts": [],
        "scores": [
            {
                "target": "cpi",
                "contestant": "naive",
                "window": "all",
                "n": 45,
                "mae": 0.25,
                "rmse": 0.31,
                "coverage_90": 0.8,
                "dm_vs_naive_p": None,
                "n_intervals": 5,
                "coverage_90_lo": 0.3755,
                "coverage_90_hi": 0.9638,
                "pinball_05": 0.0412,
                "pinball_50": 0.125,
                "pinball_95": 0.0398,
                "aci_n": 5,
                "aci_coverage_90": 0.8,
            },
            {
                "target": "cpi",
                "contestant": "ar",
                "window": "clean",
                "n": 12,
                "mae": 0.18,
                "rmse": 0.22,
                "coverage_90": None,
                "dm_vs_naive_p": 0.0412,
                "n_intervals": 0,
                "coverage_90_lo": None,
                "coverage_90_hi": None,
                "pinball_05": None,
                "pinball_50": None,
                "pinball_95": None,
                "aci_n": 0,
                "aci_coverage_90": None,
            },
        ],
    }

    csv_rows = list(csv.reader(io.StringIO(arena_scores_csv(arena))))
    assert csv_rows[0] == EXPECTED_CSV_HEADER
    assert csv_rows[1] == [
        "cpi",
        "naive",
        "Naive",
        "all",
        "45",
        "0.25",
        "0.31",
        "0.8",
        "",
        "5",
        "0.3755",
        "0.9638",
        "0.0412",
        "0.125",
        "0.0398",
        "5",
        "0.8",
    ]
    assert csv_rows[2] == [
        "cpi",
        "ar",
        "AR, lag 1",
        "clean",
        "12",
        "0.18",
        "0.22",
        "",
        "0.0412",
        "0",
        "",
        "",
        "",
        "",
        "",
        "0",
        "",
    ]

    out = tmp_path / "public"
    out.mkdir()
    (out / "arena.json").write_text(json.dumps(arena), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps({"series": []}), encoding="utf-8")
    write_open_data(out)
    _f_pq, s_pq, _r_pq = write_open_data_parquet(out)

    df = pl.read_parquet(s_pq)
    assert df.columns == EXPECTED_CSV_HEADER
    assert df.schema["n_intervals"] == pl.Int64
    assert df.schema["aci_n"] == pl.Int64
    assert df.schema["pinball_50"] == pl.Float64
    dicts = df.to_dicts()
    assert dicts[0]["n_intervals"] == 5
    assert dicts[0]["pinball_05"] == pytest.approx(0.0412)
    assert dicts[1]["n_intervals"] == 0
    assert dicts[1]["coverage_90_lo"] is None
    assert dicts[1]["pinball_50"] is None
    assert dicts[1]["aci_coverage_90"] is None
