from __future__ import annotations

import json
import math
from datetime import date, timedelta

import polars as pl
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from macro_event_lab import cli
from macro_event_lab.arena.metrics import student_t_cdf
from macro_event_lab.reactions import build_reactions, write_reactions


def test_yield_change_over_holiday_gap_and_missing_close_dropped() -> None:
    first_prints = [
        # Monday release after a Friday holiday (July 3 missing/null): change from July 2
        {
            "target": "payrolls",
            "reference_period": date(2026, 6, 1),
            "release_date": date(2026, 7, 6),
            "first_print": 200.0,
        },
        # Release on market holiday (July 3 has value None): dropped
        {
            "target": "cpi",
            "reference_period": date(2026, 6, 1),
            "release_date": date(2026, 7, 3),
            "first_print": 0.4,
        },
        # Release on earliest date with no prior close: dropped
        {
            "target": "cpi",
            "reference_period": date(2026, 5, 1),
            "release_date": date(2026, 7, 2),
            "first_print": 0.2,
        },
    ]
    arena_forecasts = [
        {
            "target": "payrolls",
            "period": "2026-06-01",
            "values": {"ar": 150.0, "ridge": 170.0},
        },
        {
            "target": "cpi",
            "period": "2026-06-01",
            "values": {"ar": 0.3, "ridge": 0.3},
        },
        {
            "target": "cpi",
            "period": "2026-05-01",
            "values": {"ar": 0.2, "ridge": 0.2},
        },
    ]
    yields = [
        {"date": date(2026, 7, 2), "series": "DGS2", "value": 3.90},
        {"date": date(2026, 7, 3), "series": "DGS2", "value": None},
        {"date": date(2026, 7, 6), "series": "DGS2", "value": 3.95},
        {"date": date(2026, 7, 2), "series": "DGS10", "value": 4.30},
        {"date": date(2026, 7, 3), "series": "DGS10", "value": None},
        {"date": date(2026, 7, 6), "series": "DGS10", "value": 4.28},
    ]

    out = build_reactions(first_prints, arena_forecasts, yields)
    assert out["schema_version"] == 1
    assert len(out["rows"]) == 1
    row = out["rows"][0]
    # Benchmark: (150 + 170) / 2 = 160.0; surprise: 200.0 - 160.0 = 40.0
    # 2Y change: (3.95 - 3.90) * 100 = 5.0 bp; 10Y change: (4.28 - 4.30) * 100 = -2.0 bp
    assert row == {
        "target": "payrolls",
        "period": "2026-06-01",
        "release_date": "2026-07-06",
        "first_print": 200.0,
        "benchmark": 160.0,
        "benchmark_kind": "models",
        "surprise": 40.0,
        "d2y_bp": 5.0,
        "d10y_bp": -2.0,
    }


def test_benchmark_rules_for_each_target_and_thin_summary_nulls() -> None:
    first_prints = [
        # GDP with spf uses survey even when models also exist
        {
            "target": "gdp",
            "reference_period": "2025-01-01",
            "release_date": "2025-04-30",
            "first_print": 2.4,
        },
        # GDP without spf falls back to mean of available models (ar, ridge, lasso: 3 models)
        {
            "target": "gdp",
            "reference_period": "2025-04-01",
            "release_date": "2025-07-30",
            "first_print": 1.8,
        },
        # CPI ignores spf and averages ar + ridge + factor_ridge (3 models)
        {
            "target": "cpi",
            "reference_period": "2025-05-01",
            "release_date": "2025-06-11",
            "first_print": 0.3,
        },
        # Payrolls with only 1 model forecast is dropped
        {
            "target": "payrolls",
            "reference_period": "2025-05-01",
            "release_date": "2025-06-06",
            "first_print": 140.0,
        },
    ]
    arena_forecasts = [
        {
            "target": "gdp",
            "period": "2025-01-01",
            "values": {"spf": 2.1, "ar": 1.9, "ridge": 2.0, "naive": 1.5},
        },
        {
            "target": "gdp",
            "period": "2025-04-01",
            "values": {"spf": None, "ar": 1.0, "ridge": 1.5, "lasso": 2.0, "naive": 3.0},
        },
        {
            "target": "cpi",
            "period": "2025-05-01",
            "values": {"spf": 0.9, "ar": 0.1, "ridge": 0.2, "factor_ridge": 0.3},
        },
        {
            "target": "payrolls",
            "period": "2025-05-01",
            "values": {"naive": 120.0, "ar": 130.0},
        },
    ]
    yields = [
        {"date": "2025-04-29", "series": "DGS2", "value": 4.00},
        {"date": "2025-04-30", "series": "DGS2", "value": 4.03},
        {"date": "2025-04-29", "series": "DGS10", "value": 4.50},
        {"date": "2025-04-30", "series": "DGS10", "value": 4.52},
        {"date": "2025-06-05", "series": "DGS2", "value": 4.10},
        {"date": "2025-06-06", "series": "DGS2", "value": 4.12},
        {"date": "2025-06-05", "series": "DGS10", "value": 4.60},
        {"date": "2025-06-06", "series": "DGS10", "value": 4.61},
        {"date": "2025-06-10", "series": "DGS2", "value": 4.12},
        {"date": "2025-06-11", "series": "DGS2", "value": 4.16},
        {"date": "2025-06-10", "series": "DGS10", "value": 4.61},
        {"date": "2025-06-11", "series": "DGS10", "value": 4.64},
        {"date": "2025-07-29", "series": "DGS2", "value": 4.20},
        {"date": "2025-07-30", "series": "DGS2", "value": 4.21},
        {"date": "2025-07-29", "series": "DGS10", "value": 4.70},
        {"date": "2025-07-30", "series": "DGS10", "value": 4.72},
    ]

    out = build_reactions(first_prints, arena_forecasts, yields)
    rows = out["rows"]
    # Sorted by target, then period: cpi first, then gdp 2025-01-01, then gdp 2025-04-01
    assert [(r["target"], r["period"]) for r in rows] == [
        ("cpi", "2025-05-01"),
        ("gdp", "2025-01-01"),
        ("gdp", "2025-04-01"),
    ]
    assert rows[0]["benchmark_kind"] == "models"
    assert rows[0]["benchmark"] == 0.2  # (0.1 + 0.2 + 0.3) / 3
    assert rows[0]["surprise"] == 0.1  # 0.3 - 0.2
    assert rows[1]["benchmark_kind"] == "survey"
    assert rows[1]["benchmark"] == 2.1
    assert rows[1]["surprise"] == 0.3  # 2.4 - 2.1
    assert rows[2]["benchmark_kind"] == "models"
    assert rows[2]["benchmark"] == 1.5  # (1.0 + 1.5 + 2.0) / 3
    assert rows[2]["surprise"] == 0.3  # 1.8 - 1.5

    summary_by_target = {item["target"]: item for item in out["summary"]}
    assert summary_by_target["cpi"] == {
        "target": "cpi",
        "n": 1,
        "corr_2y": None,
        "corr_10y": None,
        "slope_10y_bp_per_unit": None,
        "p_10y": None,
    }
    assert summary_by_target["gdp"]["n"] == 2
    assert summary_by_target["gdp"]["p_10y"] is None
    assert summary_by_target["payrolls"]["n"] == 0
    assert summary_by_target["payrolls"]["slope_10y_bp_per_unit"] is None


def test_slope_correlation_and_p_value_hand_computed_for_ten_releases() -> None:
    # Surprises: [-2.0, -1.5, -1.0, -0.5, 0.0, 0.0, 0.5, 1.0, 1.5, 2.0] (mean = 0, sxx = 15.0)
    # d10y_bp:   [-1.0, -2.0,  1.0, -1.0, 2.0, -2.0, 1.0, -1.0, 2.0, 1.0] (mean = 0, syy = 22.0)
    # sxy = (-2)(-1) + (-1.5)(-2) + (-1)(1) + (-0.5)(-1) + 0 + 0 + 0.5(1) + 1(-1) + 1.5(2) + 2(1)
    #     = 2 + 3 - 1 + 0.5 + 0.5 - 1 + 3 + 2 = 9.0
    # slope = 9.0 / 15.0 = 0.6 bp per unit
    # ssr = 22.0 - 0.6 * 9.0 = 16.6; se = sqrt((16.6 / 8) / 15.0) = sqrt(2.075 / 15.0)
    # t = 0.6 / sqrt(2.075 / 15.0); p = 2 * (1 - student_t_cdf(t, 8))
    # corr_10y = 9.0 / sqrt(15.0 * 22.0)
    # d2y_bp = [2 * x for x in surprises], so corr_2y = 1.0 exactly.
    surprises = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.0, 0.5, 1.0, 1.5, 2.0]
    d10y_changes = [-1.0, -2.0, 1.0, -1.0, 2.0, -2.0, 1.0, -1.0, 2.0, 1.0]

    first_prints = []
    arena_forecasts = []
    yields = []
    start = date(2024, 1, 10)
    for idx, (s_val, dy10) in enumerate(zip(surprises, d10y_changes, strict=True)):
        period = date(2024 + idx // 12, (idx % 12) + 1, 1)
        prev_day = start + timedelta(days=idx * 10)
        rel_day = prev_day + timedelta(days=1)
        first_prints.append(
            {
                "target": "cpi",
                "reference_period": period,
                "release_date": rel_day,
                "first_print": s_val,
            }
        )
        arena_forecasts.append(
            {
                "target": "cpi",
                "period": period.isoformat(),
                "values": {"ar": 0.0, "ridge": 0.0},
            }
        )
        dy2 = 2.0 * s_val
        yields.extend(
            [
                {"date": prev_day, "series": "DGS2", "value": 4.0},
                {"date": rel_day, "series": "DGS2", "value": 4.0 + dy2 / 100.0},
                {"date": prev_day, "series": "DGS10", "value": 4.5},
                {"date": rel_day, "series": "DGS10", "value": 4.5 + dy10 / 100.0},
            ]
        )

    out = build_reactions(first_prints, arena_forecasts, yields)
    cpi_summary = next(item for item in out["summary"] if item["target"] == "cpi")

    expected_t = 0.6 / math.sqrt((16.6 / 8.0) / 15.0)
    expected_p = round(2.0 * (1.0 - student_t_cdf(expected_t, 8)), 4)
    expected_corr_10y = round(9.0 / math.sqrt(15.0 * 22.0), 4)

    assert cpi_summary["n"] == 10
    assert cpi_summary["corr_2y"] == 1.0
    assert cpi_summary["corr_10y"] == expected_corr_10y
    assert cpi_summary["slope_10y_bp_per_unit"] == 0.6
    assert cpi_summary["p_10y"] == expected_p


def test_cli_reactions_refuses_when_yields_missing_and_writes_when_present(
    tmp_path, capsys,
) -> None:
    silver_dir = tmp_path / "silver"
    web_dir = tmp_path / "web_public"
    silver_dir.mkdir(parents=True)
    web_dir.mkdir(parents=True)

    # ALFRED observations without DGS2 / DGS10
    obs_no_yields = pl.DataFrame(
        [
            ("CPIAUCSL", date(2025, 1, 1), 100.0, date(2025, 2, 12), None),
            ("CPIAUCSL", date(2025, 2, 1), 100.5, date(2025, 3, 12), None),
        ],
        schema={
            "series_id": pl.String,
            "observation_date": pl.Date,
            "value": pl.Float64,
            "realtime_start": pl.Date,
            "realtime_end": pl.Date,
        },
        orient="row",
    )
    obs_no_yields.write_parquet(silver_dir / "alfred_observations.parquet")
    arena_payload = {
        "schema_version": 1,
        "targets": [
            {
                "id": "gdp",
                "label": "GDP growth",
                "unit": "annualized percent q/q",
                "frequency": "quarterly",
            },
            {
                "id": "cpi",
                "label": "Inflation",
                "unit": "percent m/m",
                "frequency": "monthly",
            },
            {
                "id": "payrolls",
                "label": "Payrolls",
                "unit": "thousands of jobs",
                "frequency": "monthly",
            },
        ],
        "forecasts": [
            {"target": "cpi", "period": "2025-02-01", "values": {"ar": 0.3, "ridge": 0.5}},
        ],
    }
    (web_dir / "arena.json").write_text(json.dumps(arena_payload), encoding="utf-8")
    out_path = web_dir / "reactions.json"

    with pytest.raises(SystemExit) as exc_info:
        cli.main(["reactions", "--yields-from", str(tmp_path), "--out", str(out_path)])
    assert exc_info.value.code == 1
    assert not out_path.exists()
    assert "DGS2" in capsys.readouterr().err

    # Add DGS2 and DGS10 rows and re-run
    obs_with_yields = pl.concat(
        [
            obs_no_yields,
            pl.DataFrame(
                [
                    ("DGS2", date(2025, 3, 11), 3.90, date(2025, 3, 11), None),
                    ("DGS2", date(2025, 3, 12), 3.96, date(2025, 3, 12), None),
                    ("DGS10", date(2025, 3, 11), 4.25, date(2025, 3, 11), None),
                    ("DGS10", date(2025, 3, 12), 4.30, date(2025, 3, 12), None),
                ],
                schema=obs_no_yields.schema,
                orient="row",
            ),
        ]
    )
    obs_with_yields.write_parquet(silver_dir / "alfred_observations.parquet")

    n_rows = write_reactions(tmp_path, out_path)
    assert n_rows == 1
    assert out_path.exists()
    text = out_path.read_text(encoding="utf-8")
    assert text.endswith("\n")
    parsed = json.loads(text)
    assert parsed["units"] == {
        "gdp": "annualized percent q/q",
        "cpi": "percent m/m",
        "payrolls": "thousands of jobs",
    }
    assert f"Wrote {out_path}: 1 rows" in capsys.readouterr().out


@given(
    surprises=st.lists(
        st.floats(min_value=-10.0, max_value=10.0, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=25,
    ),
    d2ys=st.lists(
        st.floats(min_value=-50.0, max_value=50.0, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=25,
    ),
    d10ys=st.lists(
        st.floats(min_value=-50.0, max_value=50.0, allow_nan=False, allow_infinity=False),
        min_size=0,
        max_size=25,
    ),
)
@settings(max_examples=40)
def test_hypothesis_row_count_and_correlation_bounds(
    surprises: list[float], d2ys: list[float], d10ys: list[float],
) -> None:
    count = min(len(surprises), len(d2ys), len(d10ys))
    first_prints = []
    arena_forecasts = []
    yields = []
    base = date(2020, 1, 10)
    for idx in range(count):
        period = date(2020 + idx // 12, (idx % 12) + 1, 1)
        prev_day = base + timedelta(days=idx * 5)
        rel_day = prev_day + timedelta(days=1)
        first_prints.append(
            {
                "target": "cpi",
                "reference_period": period,
                "release_date": rel_day,
                "first_print": surprises[idx],
            }
        )
        arena_forecasts.append(
            {
                "target": "cpi",
                "period": period.isoformat(),
                "values": {"ar": 0.0, "ridge": 0.0},
            }
        )
        yields.extend(
            [
                {"date": prev_day, "series": "DGS2", "value": 3.0},
                {"date": rel_day, "series": "DGS2", "value": 3.0 + d2ys[idx] / 100.0},
                {"date": prev_day, "series": "DGS10", "value": 4.0},
                {"date": rel_day, "series": "DGS10", "value": 4.0 + d10ys[idx] / 100.0},
            ]
        )

    out = build_reactions(first_prints, arena_forecasts, yields)
    assert len(out["rows"]) <= len(first_prints)
    for item in out["summary"]:
        for key in ("corr_2y", "corr_10y"):
            if item[key] is not None:
                assert -1.0 <= item[key] <= 1.0
