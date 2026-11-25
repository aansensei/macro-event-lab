import csv
import json
from datetime import date
from pathlib import Path

import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq

from macro_event_lab.open_data import (
    write_open_data,
    write_open_data_parquet,
)


def _sample_arena() -> dict:
    return {
        "schema_version": 1,
        "information_date": "2026-11-24",
        "targets": [
            {"id": "gdp", "label": "GDP growth", "unit": "annualized percent q/q"},
            {"id": "cpi", "label": "Inflation", "unit": "percent m/m"},
        ],
        "contestants": [
            {"id": "naive", "label": "Naive", "kind": "baseline", "note": "n"},
            {"id": "ar", "label": "AR, lag 1", "kind": "classical", "note": "a"},
        ],
        "forecasts": [
            {
                "target": "gdp",
                "period": "2026-01-01",
                "made_on": "2026-04-28",
                "actual": 2.125,
                "values": {"ar": 1.9, "naive": 2, "extra": 9.9},
                "intervals": {
                    "ar": {"level": 0.9, "lo": 0.5, "hi": 3.3},
                    "naive": {"level": 0.9, "lo": None, "hi": 3.1},
                },
            },
            {
                "target": "cpi",
                "period": "2026-10-01",
                "made_on": "2026-11-10",
                "actual": None,
                "values": {"naive": 0.25, "ar": None},
                "intervals": {},
            },
        ],
        "scores": [
            {
                "target": "cpi",
                "contestant": "ar",
                "window": "clean",
                "n": 12,
                "mae": 0.15,
                "rmse": 0.21,
                "coverage_90": 0.9167,
                "dm_vs_naive_p": 0.00005,
            },
            {
                "target": "gdp",
                "contestant": "naive",
                "window": "all",
                "n": 40,
                "mae": 0.65,
                "rmse": 0.85,
                "coverage_90": 0.875,
                "dm_vs_naive_p": None,
            },
        ],
    }


def _sample_revisions() -> dict:
    return {
        "schema_version": 1,
        "settled_months": 24,
        "series": [
            {
                "series": "cpi",
                "label": "CPI",
                "unit": "% m/m",
                "points": [
                    {
                        "period": "2024-01-01",
                        "first": 0.3,
                        "next": 0.4,
                        "latest": 0.4,
                        "settled": True,
                    },
                    {
                        "period": "2026-09-01",
                        "first": 0.2,
                        "next": None,
                        "latest": 0.2,
                        "settled": False,
                    },
                ],
            },
            {
                "series": "payrolls",
                "label": "Jobs",
                "unit": "jobs",
                "points": [
                    {
                        "period": "2024-02-01",
                        "first": 275000.0,
                        "next": 270000.0,
                        "latest": 236000.0,
                        "settled": True,
                    },
                ],
            },
        ],
    }


def _write_inputs(out: Path, arena: dict, revisions: dict) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "arena.json").write_text(json.dumps(arena), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps(revisions), encoding="utf-8")


def test_write_open_data_parquet_returns_three_paths_and_schemas(tmp_path: Path) -> None:
    out = tmp_path / "public"
    _write_inputs(out, _sample_arena(), _sample_revisions())

    forecasts_p, scores_p, revisions_p = write_open_data_parquet(out)
    assert forecasts_p == out / "arena_forecasts.parquet"
    assert scores_p == out / "arena_scores.parquet"
    assert revisions_p == out / "revisions.parquet"
    assert all(p.is_file() for p in (forecasts_p, scores_p, revisions_p))

    f_df = pl.read_parquet(forecasts_p)
    assert dict(f_df.schema) == {
        "target": pl.String,
        "period": pl.Date,
        "made_on": pl.Date,
        "contestant_id": pl.String,
        "contestant": pl.String,
        "kind": pl.String,
        "forecast": pl.Float64,
        "first_print": pl.Float64,
        "interval_lo": pl.Float64,
        "interval_hi": pl.Float64,
        "error": pl.Float64,
    }
    assert f_df["period"].dtype == pl.Date
    assert f_df["made_on"].dtype == pl.Date

    s_df = pl.read_parquet(scores_p)
    assert dict(s_df.schema) == {
        "target": pl.String,
        "contestant_id": pl.String,
        "contestant": pl.String,
        "window": pl.String,
        "n": pl.Int64,
        "mae": pl.Float64,
        "rmse": pl.Float64,
        "coverage_90": pl.Float64,
        "dm_vs_naive_p": pl.Float64,
    }
    assert s_df["n"].dtype == pl.Int64

    r_df = pl.read_parquet(revisions_p)
    assert dict(r_df.schema) == {
        "series": pl.String,
        "label": pl.String,
        "unit": pl.String,
        "period": pl.Date,
        "first_print": pl.Float64,
        "next_print": pl.Float64,
        "latest": pl.Float64,
        "settled": pl.Boolean,
    }
    assert r_df["period"].dtype == pl.Date
    assert r_df["settled"].dtype == pl.Boolean


def test_parquet_matches_csv_rows_cells_nulls_and_zstd(tmp_path: Path) -> None:
    out = tmp_path / "public"
    _write_inputs(out, _sample_arena(), _sample_revisions())

    csv_paths = write_open_data(out)
    parquet_paths = (
        out / "arena_forecasts.parquet",
        out / "arena_scores.parquet",
        out / "revisions.parquet",
    )
    assert csv_paths == (
        out / "arena_forecasts.csv",
        out / "arena_scores.csv",
        out / "revisions.csv",
    )
    assert all(p.is_file() for p in parquet_paths)

    for pq_path in parquet_paths:
        pf = pq.ParquetFile(pq_path)
        assert pf.metadata.num_row_groups >= 1
        for col_idx in range(pf.metadata.num_columns):
            assert pf.metadata.row_group(0).column(col_idx).compression == "ZSTD"
        assert "__index_level_" not in " ".join(pf.schema_arrow.names)

    f_table = pq.read_table(parquet_paths[0])
    assert f_table.schema.field("period").type == pa.date32()
    assert f_table.schema.field("made_on").type == pa.date32()
    with csv_paths[0].open("r", encoding="utf-8", newline="") as handle:
        f_csv = list(csv.DictReader(handle))
    f_pq = pl.read_parquet(parquet_paths[0]).to_dicts()
    assert len(f_pq) == len(f_csv)
    for row_pq, row_csv in zip(f_pq, f_csv, strict=True):
        assert row_pq["target"] == row_csv["target"]
        assert row_pq["period"] == date.fromisoformat(row_csv["period"])
        assert row_pq["made_on"] == date.fromisoformat(row_csv["made_on"])
        assert row_pq["contestant_id"] == row_csv["contestant_id"]
        assert row_pq["contestant"] == row_csv["contestant"]
        assert row_pq["kind"] == row_csv["kind"]
        for col in ("forecast", "first_print", "interval_lo", "interval_hi", "error"):
            if row_csv[col] == "":
                assert row_pq[col] is None
            else:
                assert row_pq[col] == float(row_csv[col])

    s_table = pq.read_table(parquet_paths[1])
    assert s_table.schema.field("n").type == pa.int64()
    with csv_paths[1].open("r", encoding="utf-8", newline="") as handle:
        s_csv = list(csv.DictReader(handle))
    s_pq = pl.read_parquet(parquet_paths[1]).to_dicts()
    assert len(s_pq) == len(s_csv)
    for row_pq, row_csv in zip(s_pq, s_csv, strict=True):
        assert row_pq["target"] == row_csv["target"]
        assert row_pq["contestant_id"] == row_csv["contestant_id"]
        assert row_pq["contestant"] == row_csv["contestant"]
        assert row_pq["window"] == row_csv["window"]
        assert row_pq["n"] == int(row_csv["n"])
        for col in ("mae", "rmse", "coverage_90", "dm_vs_naive_p"):
            if row_csv[col] == "":
                assert row_pq[col] is None
            else:
                assert row_pq[col] == float(row_csv[col])

    with csv_paths[2].open("r", encoding="utf-8", newline="") as handle:
        r_csv = list(csv.DictReader(handle))
    r_pq = pl.read_parquet(parquet_paths[2]).to_dicts()
    assert len(r_pq) == len(r_csv)
    for row_pq, row_csv in zip(r_pq, r_csv, strict=True):
        assert row_pq["series"] == row_csv["series"]
        assert row_pq["label"] == row_csv["label"]
        assert row_pq["unit"] == row_csv["unit"]
        assert row_pq["period"] == date.fromisoformat(row_csv["period"])
        for col in ("first_print", "next_print", "latest"):
            if row_csv[col] == "":
                assert row_pq[col] is None
            else:
                assert row_pq[col] == float(row_csv[col])
        assert row_pq["settled"] is (row_csv["settled"] == "true")


def test_write_open_data_parquet_handles_empty_tables(tmp_path: Path) -> None:
    out = tmp_path / "empty"
    _write_inputs(
        out,
        {"contestants": [], "forecasts": [], "scores": []},
        {"series": []},
    )
    forecasts_p, scores_p, revisions_p = write_open_data_parquet(out)
    assert pl.read_parquet(forecasts_p).height == 0
    assert pl.read_parquet(scores_p).height == 0
    assert pl.read_parquet(revisions_p).height == 0
