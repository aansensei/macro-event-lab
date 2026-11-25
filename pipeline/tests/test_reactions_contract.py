"""Contract acceptance tests for macro_event_lab.reactions and the reactions CLI."""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import polars as pl
import pytest

from macro_event_lab import cli
from macro_event_lab.arena import metrics
from macro_event_lab.reactions import build_reactions

# Expected two-sided Student t p-value for n=10 (df=8), SSE=60, Sxx=20, slope=1.0:
# se = sqrt((60 / 8) / 20) = sqrt(0.375), t = 1.0 / sqrt(0.375) = sqrt(8 / 3).
# I_{0.75}(4, 0.5) = 1 - sqrt(1 - 0.75) * (1 + 0.75/2 + (3/8)*0.75^2 + (5/16)*0.75^3)
# = 1 - 0.5 * 1.7177734375 = 0.14111328125.
EXPECTED_P_10Y_HAND = round(0.14111328125, 4)


def _sample_yield_pair(day: str, d2y: float | None, d10y: float | None) -> list[dict[str, Any]]:
    return [
        {"date": day, "series": "DGS2", "value": d2y},
        {"date": day, "series": "DGS10", "value": d10y},
    ]


def _fp(target: str, period: str, release_date: str, value: float) -> dict[str, Any]:
    return {
        "target": target,
        "reference_period": period,
        "release_date": release_date,
        "first_print": value,
    }


def test_build_reactions_holiday_gap_and_missing_close_dropping() -> None:
    # CPI 2025-01-01 releases on 2025-02-12; 2025-02-11 is a holiday, prior close is 2025-02-10.
    # Benchmark uses mean of ar (0.3) and ridge (0.5) = 0.4; naive (0.9) is ignored.
    # Surprise = 0.5 - 0.4 = 0.1.
    # d2y_bp = (4.31 - 4.20) * 100 = 11.0; d10y_bp = (4.63 - 4.48) * 100 = 15.0.
    # CPI 2025-02-01 has only one model (ar), so it is dropped.
    # Payrolls 2025-01-01 releases on 2025-02-07 when DGS10 is missing, so it is dropped.
    first_prints = [
        _fp("cpi", "2025-01-01", "2025-02-12", 0.5),
        _fp("cpi", "2025-02-01", "2025-03-12", 0.2),
        _fp("payrolls", "2025-01-01", "2025-02-07", 143.0),
    ]
    arena_forecasts = [
        {
            "target": "cpi",
            "period": "2025-01-01",
            "values": {"naive": 0.9, "ar": 0.3, "ridge": 0.5},
        },
        {"target": "cpi", "period": "2025-02-01", "values": {"naive": 0.5, "ar": 0.3}},
        {"target": "payrolls", "period": "2025-01-01", "values": {"ar": 160.0, "ridge": 170.0}},
    ]
    yields = [
        *_sample_yield_pair("2025-02-06", 4.18, 4.44),
        *_sample_yield_pair("2025-02-07", 4.22, None),
        *_sample_yield_pair("2025-02-10", 4.20, 4.48),
        *_sample_yield_pair("2025-02-11", None, None),
        *_sample_yield_pair("2025-02-12", 4.31, 4.63),
        *_sample_yield_pair("2025-03-11", 3.95, 4.28),
        *_sample_yield_pair("2025-03-12", 4.00, 4.30),
    ]

    result = build_reactions(first_prints, arena_forecasts, yields)

    assert result["schema_version"] == 1
    assert set(result["units"]) == {"gdp", "cpi", "payrolls"}
    assert all(isinstance(v, str) and v for v in result["units"].values())
    assert len(result["rows"]) == 1
    assert result["rows"][0] == {
        "target": "cpi",
        "period": "2025-01-01",
        "release_date": "2025-02-12",
        "first_print": 0.5,
        "benchmark": 0.4,
        "benchmark_kind": "models",
        "surprise": 0.1,
        "d2y_bp": 11.0,
        "d10y_bp": 15.0,
    }


def test_build_reactions_drops_row_when_no_earlier_yield_close_exists() -> None:
    first_prints = [_fp("cpi", "2025-01-01", "2025-02-12", 0.5)]
    arena_forecasts = [
        {"target": "cpi", "period": "2025-01-01", "values": {"ar": 0.3, "ridge": 0.5}},
    ]
    yields = _sample_yield_pair("2025-02-12", 4.31, 4.63)

    result = build_reactions(first_prints, arena_forecasts, yields)
    assert result["rows"] == []


def test_build_reactions_benchmark_rules_for_each_target_and_sorting() -> None:
    # GDP uses spf when present and non-null, otherwise mean of available models.
    # CPI and payrolls always use models even if spf is present.
    # Output rows are sorted by target, then period.
    first_prints = [
        _fp("payrolls", "2024-05-01", "2024-06-07", 272.0),
        _fp("gdp", "2024-04-01", "2024-07-25", 2.8),
        _fp("gdp", "2024-01-01", "2024-04-25", 1.6),
        _fp("cpi", "2024-05-01", "2024-06-12", 0.3),
    ]
    arena_forecasts = [
        {
            "target": "gdp",
            "period": "2024-01-01",
            "values": {"spf": 2.5, "ar": 1.8, "ridge": 2.0, "factor_ridge": 2.1, "lasso": 2.2},
        },
        {
            "target": "gdp",
            "period": "2024-04-01",
            "values": {"spf": None, "ar": 1.8, "ridge": 2.0, "lasso": 2.2},
        },
        {
            "target": "cpi",
            "period": "2024-05-01",
            "values": {"spf": 0.1, "ar": 0.2, "ridge": 0.4},
        },
        {
            "target": "payrolls",
            "period": "2024-05-01",
            "values": {"spf": 180.0, "ar": 190.0, "factor_ridge": 210.0},
        },
    ]
    yields = [
        *_sample_yield_pair("2024-04-24", 4.90, 4.65),
        *_sample_yield_pair("2024-04-25", 4.98, 4.70),
        *_sample_yield_pair("2024-06-06", 4.72, 4.28),
        *_sample_yield_pair("2024-06-07", 4.87, 4.43),
        *_sample_yield_pair("2024-06-11", 4.83, 4.40),
        *_sample_yield_pair("2024-06-12", 4.75, 4.31),
        *_sample_yield_pair("2024-07-24", 4.41, 4.28),
        *_sample_yield_pair("2024-07-25", 4.44, 4.25),
    ]

    result = build_reactions(first_prints, arena_forecasts, yields)
    rows = result["rows"]
    assert [(r["target"], r["period"]) for r in rows] == [
        ("cpi", "2024-05-01"),
        ("gdp", "2024-01-01"),
        ("gdp", "2024-04-01"),
        ("payrolls", "2024-05-01"),
    ]

    cpi_row, gdp_q1, gdp_q2, pay_row = rows
    assert cpi_row["benchmark"] == 0.3
    assert cpi_row["benchmark_kind"] == "models"
    assert cpi_row["surprise"] == 0.0

    assert gdp_q1["benchmark"] == 2.5
    assert gdp_q1["benchmark_kind"] == "survey"
    assert gdp_q1["surprise"] == -0.9

    assert gdp_q2["benchmark"] == 2.0
    assert gdp_q2["benchmark_kind"] == "models"
    assert gdp_q2["surprise"] == 0.8

    assert pay_row["benchmark"] == 200.0
    assert pay_row["benchmark_kind"] == "models"
    assert pay_row["surprise"] == 72.0
    assert pay_row["d2y_bp"] == 15.0
    assert pay_row["d10y_bp"] == 15.0


def test_build_reactions_summary_statistics_and_n_below_ten_nulls() -> None:
    # 10 CPI releases with x = [-2, -1, 0, 1, 2, -2, -1, 0, 1, 2],
    # y10 = [2, -4, 1, -1, 2, -6, 2, -1, 3, 2], y2 = -y10:
    # mean(x) = 0, Sxx = 20, mean(y10) = 0, Sy10y10 = 80, Sxy10 = 20
    # slope_10y = 1.0, corr_10y = 0.5, corr_2y = -0.5, SSE = 60, df = 8, s^2 = 7.5
    # se = sqrt(0.375), t = sqrt(8 / 3), p_10y = 0.1411.
    # Also 9 GDP releases (n < 10) to verify all summary stats are None.
    surprises = [-2.0, -1.0, 0.0, 1.0, 2.0, -2.0, -1.0, 0.0, 1.0, 2.0]
    d10y_bps = [2.0, -4.0, 1.0, -1.0, 2.0, -6.0, 2.0, -1.0, 3.0, 2.0]
    d2y_bps = [-v for v in d10y_bps]

    first_prints: list[dict[str, Any]] = []
    arena_forecasts: list[dict[str, Any]] = []
    yields: list[dict[str, Any]] = []
    base_day = date(2020, 1, 2)

    for idx, (surp, d2y, d10y) in enumerate(zip(surprises, d2y_bps, d10y_bps, strict=True)):
        period = f"2020-{idx + 1:02d}-01"
        prev_day = (base_day + timedelta(days=idx * 5)).isoformat()
        rel_day = (base_day + timedelta(days=idx * 5 + 1)).isoformat()
        first_prints.append(_fp("cpi", period, rel_day, round(1.0 + surp, 4)))
        arena_forecasts.append(
            {"target": "cpi", "period": period, "values": {"ar": 0.9, "ridge": 1.1}}
        )
        yields.extend(_sample_yield_pair(prev_day, 2.00, 3.00))
        d2y_close = round(2.00 + d2y / 100.0, 4)
        d10y_close = round(3.00 + d10y / 100.0, 4)
        yields.extend(_sample_yield_pair(rel_day, d2y_close, d10y_close))

    for idx in range(9):
        if idx < 4:
            period = f"2021-{idx * 3 + 1:02d}-01"
        elif idx < 8:
            period = f"2022-{(idx - 4) * 3 + 1:02d}-01"
        else:
            period = "2023-01-01"
        prev_day = (base_day + timedelta(days=100 + idx * 5)).isoformat()
        rel_day = (base_day + timedelta(days=100 + idx * 5 + 1)).isoformat()
        first_prints.append(_fp("gdp", period, rel_day, 2.0 + 0.1 * idx))
        arena_forecasts.append({"target": "gdp", "period": period, "values": {"spf": 2.0}})
        yields.extend(_sample_yield_pair(prev_day, 2.50, 3.50))
        yields.extend(_sample_yield_pair(rel_day, 2.52, 3.55))

    result = build_reactions(first_prints, arena_forecasts, yields)
    summary_by_target = {entry["target"]: entry for entry in result["summary"]}

    cpi_summary = summary_by_target["cpi"]
    assert cpi_summary["n"] == 10
    assert cpi_summary["corr_2y"] == -0.5
    assert cpi_summary["corr_10y"] == 0.5
    assert cpi_summary["slope_10y_bp_per_unit"] == 1.0
    assert cpi_summary["p_10y"] == EXPECTED_P_10Y_HAND
    t_stat = 1.0 / math.sqrt(0.375)
    assert cpi_summary["p_10y"] == round(2.0 * (1.0 - metrics.student_t_cdf(t_stat, 8)), 4)

    gdp_summary = summary_by_target["gdp"]
    assert gdp_summary["n"] == 9
    assert gdp_summary["corr_2y"] is None
    assert gdp_summary["corr_10y"] is None
    assert gdp_summary["slope_10y_bp_per_unit"] is None
    assert gdp_summary["p_10y"] is None

    pay_summary = summary_by_target["payrolls"]
    assert pay_summary["n"] == 0
    assert pay_summary["corr_2y"] is None
    assert pay_summary["corr_10y"] is None
    assert pay_summary["slope_10y_bp_per_unit"] is None
    assert pay_summary["p_10y"] is None

    for entry in result["summary"]:
        assert "significant" not in entry
        assert "rank" not in entry


def test_cli_reactions_writes_sorted_json_and_refuses_when_yields_missing(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    data_dir = tmp_path / "data"
    silver_dir = data_dir / "silver"
    web_pub_dir = data_dir / "web_public"
    silver_dir.mkdir(parents=True)
    web_pub_dir.mkdir(parents=True)

    arena_payload = {
        "schema_version": 1,
        "information_date": "2025-03-01",
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
        "contestants": [],
        "forecasts": [
            {
                "target": "cpi",
                "period": "2025-01-01",
                "made_on": "2025-01-16",
                "actual": 0.5,
                "values": {"ar": 0.3, "ridge": 0.5},
                "intervals": {},
            },
        ],
        "scores": [],
        "leakage": [],
        "live": [],
    }
    (web_pub_dir / "arena.json").write_text(json.dumps(arena_payload), encoding="utf-8")

    missing_out = tmp_path / "out" / "missing_reactions.json"
    with pytest.raises(SystemExit) as exc_missing:
        cli.main(["reactions", "--yields-from", str(data_dir), "--out", str(missing_out)])
    assert exc_missing.value.code == 1
    assert not missing_out.exists()

    macro_only = pl.DataFrame(
        [
            {
                "series_id": "CPIAUCSL",
                "observation_date": date(2024, 12, 1),
                "value": 310.0,
                "realtime_start": date(2025, 1, 15),
                "realtime_end": date(2025, 2, 11),
            },
            {
                "series_id": "CPIAUCSL",
                "observation_date": date(2025, 1, 1),
                "value": 311.55,
                "realtime_start": date(2025, 2, 12),
                "realtime_end": None,
            },
            {
                "series_id": "CPIAUCSL",
                "observation_date": date(2024, 12, 1),
                "value": 310.0,
                "realtime_start": date(2025, 2, 12),
                "realtime_end": None,
            },
        ]
    )
    macro_only.write_parquet(silver_dir / "alfred_observations.parquet")
    with pytest.raises(SystemExit) as exc_no_yields:
        cli.main(["reactions", "--yields-from", str(data_dir), "--out", str(missing_out)])
    assert exc_no_yields.value.code == 1
    assert not missing_out.exists()

    yield_rows = pl.DataFrame(
        [
            {
                "series_id": "DGS2",
                "observation_date": date(2025, 2, 11),
                "value": 4.20,
                "realtime_start": date(2025, 2, 11),
                "realtime_end": None,
            },
            {
                "series_id": "DGS2",
                "observation_date": date(2025, 2, 12),
                "value": 4.26,
                "realtime_start": date(2025, 2, 12),
                "realtime_end": None,
            },
            {
                "series_id": "DGS10",
                "observation_date": date(2025, 2, 11),
                "value": 4.50,
                "realtime_start": date(2025, 2, 11),
                "realtime_end": None,
            },
            {
                "series_id": "DGS10",
                "observation_date": date(2025, 2, 12),
                "value": 4.54,
                "realtime_start": date(2025, 2, 12),
                "realtime_end": None,
            },
        ]
    )
    pl.concat([macro_only, yield_rows]).write_parquet(silver_dir / "alfred_observations.parquet")
    capsys.readouterr()

    out_path = tmp_path / "out" / "reactions.json"
    cli.main(["reactions", "--yields-from", str(data_dir), "--out", str(out_path)])
    printed = capsys.readouterr().out.strip()
    assert printed == f"Wrote {out_path}: 1 rows"
    assert out_path.is_file()
    raw_text = out_path.read_text(encoding="utf-8")
    assert raw_text.endswith("\n")
    parsed = json.loads(raw_text)
    assert raw_text == json.dumps(parsed, indent=2, sort_keys=True) + "\n"
    assert len(parsed["rows"]) == 1
    assert parsed["rows"][0]["d2y_bp"] == 6.0
    assert parsed["rows"][0]["d10y_bp"] == 4.0
