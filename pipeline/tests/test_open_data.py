import csv
import io
import json
from pathlib import Path

from macro_event_lab.open_data import (
    arena_forecasts_csv,
    arena_scores_csv,
    revisions_csv,
    write_open_data,
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
                "values": {"ar": 1.9, "naive": 2.0, "extra": 9.9},
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


def test_headers_row_order_and_counts() -> None:
    arena = _sample_arena()
    revisions = _sample_revisions()

    forecast_rows = list(csv.reader(io.StringIO(arena_forecasts_csv(arena))))
    assert forecast_rows[0] == [
        "target",
        "period",
        "made_on",
        "contestant_id",
        "contestant",
        "kind",
        "forecast",
        "first_print",
        "interval_lo",
        "interval_hi",
        "error",
    ]
    assert len(forecast_rows) == 5
    assert [(r[0], r[3]) for r in forecast_rows[1:]] == [
        ("gdp", "naive"),
        ("gdp", "ar"),
        ("cpi", "naive"),
        ("cpi", "ar"),
    ]

    score_rows = list(csv.reader(io.StringIO(arena_scores_csv(arena))))
    assert score_rows[0] == [
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
    assert len(score_rows) == 3
    assert [(r[0], r[1], r[2]) for r in score_rows[1:]] == [
        ("cpi", "ar", "AR, lag 1"),
        ("gdp", "naive", "Naive"),
    ]

    rev_rows = list(csv.reader(io.StringIO(revisions_csv(revisions))))
    assert rev_rows[0] == [
        "series",
        "label",
        "unit",
        "period",
        "first_print",
        "next_print",
        "latest",
        "settled",
    ]
    assert len(rev_rows) == 4
    assert [(r[0], r[3], r[7]) for r in rev_rows[1:]] == [
        ("cpi", "2024-01-01", "true"),
        ("cpi", "2026-09-01", "false"),
        ("payrolls", "2024-02-01", "true"),
    ]


def test_nulls_become_empty_cells_and_unknown_contestants_skipped() -> None:
    arena = _sample_arena()
    rows = list(csv.DictReader(io.StringIO(arena_forecasts_csv(arena))))
    assert all(row["contestant_id"] != "extra" for row in rows)
    assert rows[0]["interval_lo"] == ""
    assert rows[0]["interval_hi"] == "3.1"
    assert rows[2]["first_print"] == ""
    assert rows[2]["error"] == ""
    assert rows[3]["forecast"] == ""
    assert rows[3]["error"] == ""

    score_rows = list(csv.DictReader(io.StringIO(arena_scores_csv(arena))))
    assert score_rows[1]["dm_vs_naive_p"] == ""

    rev_rows = list(csv.DictReader(io.StringIO(revisions_csv(_sample_revisions()))))
    assert rev_rows[1]["next_print"] == ""


def test_error_rounding_and_small_float_formatting() -> None:
    arena = {
        "contestants": [{"id": "m", "label": "Model", "kind": "classical"}],
        "forecasts": [
            {
                "target": "cpi",
                "period": "2026-01-01",
                "made_on": "2026-02-01",
                "actual": 0.30004,
                "values": {"m": 0.1},
                "intervals": {"m": {"lo": 0.00001, "hi": 0.5}},
            },
            {
                "target": "cpi",
                "period": "2026-02-01",
                "made_on": "2026-03-01",
                "actual": 0.1,
                "values": {"m": 0.3},
                "intervals": {},
            },
        ],
        "scores": [
            {
                "target": "cpi",
                "contestant": "m",
                "window": "all",
                "n": 2,
                "mae": 0.123456,
                "rmse": 0.2,
                "coverage_90": 1.0,
                "dm_vs_naive_p": 0.000005,
            }
        ],
    }
    forecast_rows = list(csv.DictReader(io.StringIO(arena_forecasts_csv(arena))))
    assert forecast_rows[0]["error"] == "0.2"
    assert forecast_rows[0]["interval_lo"] == "0.00001"
    assert forecast_rows[1]["error"] == "-0.2"

    score_rows = list(csv.DictReader(io.StringIO(arena_scores_csv(arena))))
    assert score_rows[0]["dm_vs_naive_p"] == "0.000005"
    assert score_rows[0]["mae"] == "0.123456"


def test_quotes_labels_containing_commas() -> None:
    arena = _sample_arena()
    text = arena_forecasts_csv(arena)
    assert ',"AR, lag 1",' in text
    score_text = arena_scores_csv(arena)
    assert ',"AR, lag 1",' in score_text


def test_no_bom_and_lf_line_endings(tmp_path: Path) -> None:
    out = tmp_path / "public"
    out.mkdir()
    (out / "arena.json").write_text(json.dumps(_sample_arena()), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps(_sample_revisions()), encoding="utf-8")
    paths = write_open_data(out)
    for path in paths:
        raw = path.read_bytes()
        assert not raw.startswith(b"\xef\xbb\xbf")
        assert b"\r\n" not in raw
        assert raw.endswith(b"\n")


def test_write_open_data_writes_three_csv_files(tmp_path: Path) -> None:
    out = tmp_path / "public"
    out.mkdir()
    (out / "arena.json").write_text(json.dumps(_sample_arena()), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps(_sample_revisions()), encoding="utf-8")
    forecasts_path, scores_path, revisions_path = write_open_data(out)
    assert forecasts_path == out / "arena_forecasts.csv"
    assert scores_path == out / "arena_scores.csv"
    assert revisions_path == out / "revisions.csv"
    assert all(p.is_file() for p in (forecasts_path, scores_path, revisions_path))


def test_round_trip_dict_reader_matches_source_numbers(tmp_path: Path) -> None:
    arena = _sample_arena()
    revisions = _sample_revisions()
    out = tmp_path / "public"
    out.mkdir()
    (out / "arena.json").write_text(json.dumps(arena), encoding="utf-8")
    (out / "revisions.json").write_text(json.dumps(revisions), encoding="utf-8")
    forecasts_path, scores_path, revisions_path = write_open_data(out)

    with forecasts_path.open("r", encoding="utf-8", newline="") as handle:
        forecast_rows = list(csv.DictReader(handle))
    assert float(forecast_rows[0]["forecast"]) == arena["forecasts"][0]["values"]["naive"]
    assert float(forecast_rows[1]["forecast"]) == arena["forecasts"][0]["values"]["ar"]
    assert float(forecast_rows[1]["first_print"]) == arena["forecasts"][0]["actual"]
    assert float(forecast_rows[1]["error"]) == round(
        arena["forecasts"][0]["actual"] - arena["forecasts"][0]["values"]["ar"], 4
    )

    with scores_path.open("r", encoding="utf-8", newline="") as handle:
        score_rows = list(csv.DictReader(handle))
    for row, src in zip(score_rows, arena["scores"], strict=True):
        assert int(row["n"]) == src["n"]
        assert float(row["mae"]) == src["mae"]
        assert float(row["rmse"]) == src["rmse"]
        assert float(row["coverage_90"]) == src["coverage_90"]
        if src["dm_vs_naive_p"] is None:
            assert row["dm_vs_naive_p"] == ""
        else:
            assert float(row["dm_vs_naive_p"]) == src["dm_vs_naive_p"]

    with revisions_path.open("r", encoding="utf-8", newline="") as handle:
        rev_rows = list(csv.DictReader(handle))
    src_points = [p for s in revisions["series"] for p in s["points"]]
    for row, src in zip(rev_rows, src_points, strict=True):
        assert float(row["first_print"]) == src["first"]
        assert float(row["latest"]) == src["latest"]
        if src["next"] is None:
            assert row["next_print"] == ""
        else:
            assert float(row["next_print"]) == src["next"]


def test_score_new_columns_export_and_missing_values() -> None:
    arena = {
        "contestants": [{"id": "ar", "label": "AR", "kind": "classical"}],
        "forecasts": [],
        "scores": [
            {
                "target": "cpi",
                "contestant": "ar",
                "window": "all",
                "n": 50,
                "mae": 0.15,
                "rmse": 0.21,
                "coverage_90": 0.9,
                "dm_vs_naive_p": 0.04,
                "n_intervals": 10,
                "coverage_90_lo": 0.5958,
                "coverage_90_hi": 0.9821,
                "pinball_05": 0.02,
                "pinball_50": 0.075,
                "pinball_95": 0.021,
                "aci_n": 10,
                "aci_coverage_90": 0.8,
                "crps": 0.112,
                "crps_n": 10,
            },
            {
                "target": "gdp",
                "contestant": "ar",
                "window": "all",
                "n": 12,
                "mae": 0.5,
                "rmse": 0.6,
                "coverage_90": None,
                "dm_vs_naive_p": None,
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
    rows = list(csv.DictReader(io.StringIO(arena_scores_csv(arena))))
    assert rows[0]["n_intervals"] == "10"
    assert rows[0]["coverage_90_lo"] == "0.5958"
    assert rows[0]["coverage_90_hi"] == "0.9821"
    assert rows[0]["pinball_05"] == "0.02"
    assert rows[0]["pinball_50"] == "0.075"
    assert rows[0]["pinball_95"] == "0.021"
    assert rows[0]["aci_n"] == "10"
    assert rows[0]["aci_coverage_90"] == "0.8"
    assert rows[0]["crps"] == "0.112"
    assert rows[0]["crps_n"] == "10"
    assert rows[1]["n_intervals"] == "0"
    assert rows[1]["coverage_90_lo"] == ""
    assert rows[1]["pinball_05"] == ""
    assert rows[1]["aci_n"] == "0"
    assert rows[1]["aci_coverage_90"] == ""
    assert rows[1]["crps"] == ""
    assert rows[1]["crps_n"] == ""
