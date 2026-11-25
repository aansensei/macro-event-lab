from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta

import numpy as np
import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.arena import conformal, contestants, export
from macro_event_lab.arena.harness import add_intervals
from macro_event_lab.arena.targets import (
    add_months,
    build_origins,
    data_as_of,
    first_print_targets,
)

OBSERVATION_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}


def monthly_series(series_id: str, levels: list[float], start: date = date(2000, 1, 1)):
    """One vintage per observation: each month is published on the 15th of the next month."""
    rows = []
    for i, level in enumerate(levels):
        period = add_months(start, i)
        published = add_months(period, 1).replace(day=15)
        rows.append((series_id, period, level, published, None))
    return pl.DataFrame(rows, schema=OBSERVATION_SCHEMA, orient="row")


def random_walk(n: int, step: float = 0.2, base: float = 100.0) -> list[float]:
    rng = np.random.default_rng(7)
    return list(base * np.cumprod(1 + rng.normal(step / 100, 0.002, n)))


def test_first_print_targets_use_the_vintage_of_the_release_day() -> None:
    cpi = monthly_series("CPIAUCSL", [100.0, 101.0, 102.01])
    payrolls = monthly_series("PAYEMS", [1000.0, 1100.0, 1150.0])
    targets = first_print_targets(pl.concat([cpi, payrolls]))
    cpi_rows = targets.filter(pl.col("target") == "cpi").sort("period")
    assert cpi_rows["first_print"].to_list() == [1.0, 1.0]
    assert cpi_rows["release_date"].to_list() == [date(2000, 3, 15), date(2000, 4, 15)]
    jobs = targets.filter(pl.col("target") == "payrolls").sort("period")
    assert jobs["first_print"].to_list() == [100.0, 50.0]


def test_first_print_targets_ignore_periods_before_2000() -> None:
    old = monthly_series("CPIAUCSL", [100.0, 101.0, 102.0], start=date(1990, 1, 1))
    assert first_print_targets(old).height == 0


def test_monthly_origin_is_the_day_after_the_previous_release() -> None:
    targets = first_print_targets(monthly_series("CPIAUCSL", random_walk(6)))
    origins = build_origins(targets, None).sort("period")
    first = origins.row(0, named=True)
    assert first["period"] == date(2000, 3, 1)
    assert first["made_on"] == date(2000, 3, 16)
    release = {r["period"]: r["release_date"] for r in targets.iter_rows(named=True)}
    assert all(row["made_on"] < release[row["period"]] for row in origins.iter_rows(named=True))


def test_quarterly_origin_uses_the_survey_news_release_date_only() -> None:
    quarters = [date(2001, 1, 1), date(2001, 4, 1)]
    obs = pl.DataFrame(
        [("GDPC1", q, level, release, None)
         for q, level, release in zip(
             [date(2000, 10, 1)] + quarters, [100.0, 101.0, 102.0],
             [date(2001, 1, 31), date(2001, 4, 28), date(2001, 7, 28)], strict=True)],
        schema=OBSERVATION_SCHEMA, orient="row",
    )
    survey = pl.DataFrame(
        {
            "survey_year": [2001, 2001], "survey_quarter": [1, 2],
            "known_from": [datetime(2001, 2, 21, 4, 59, 59, tzinfo=UTC),
                           datetime(2001, 6, 30, 3, 59, 59, tzinfo=UTC)],
            "known_from_source": ["spf_news_release_date:end_of_day:America/New_York",
                                  "conservative_quarter_end_or_deadline:missing:America/New_York"],
        },
    )
    origins = build_origins(first_print_targets(obs), survey).filter(pl.col("target") == "gdp")
    assert origins["period"].to_list() == [date(2001, 1, 1)]
    assert origins["made_on"].to_list() == [date(2001, 2, 20)]


@given(st.integers(min_value=0, max_value=20), st.integers(min_value=0, max_value=20))
def test_data_as_of_never_returns_later_rows_and_ignores_them(as_of_day: int, extra: int) -> None:
    base = date(2020, 1, 1)
    frame = pl.DataFrame({"release_date": [base + timedelta(days=i) for i in range(10)],
                          "v": list(range(10))})
    cutoff = base + timedelta(days=as_of_day)
    kept = data_as_of(frame, cutoff)
    assert all(day <= cutoff for day in kept["release_date"])
    later = pl.DataFrame({"release_date": [cutoff + timedelta(days=1 + extra)], "v": [99]})
    assert data_as_of(pl.concat([frame, later]), cutoff).equals(kept)


def test_naive_repeats_the_latest_value_and_needs_history() -> None:
    assert contestants.naive_forecast([1.0, 2.0, 3.0]) == 3.0
    assert contestants.naive_forecast([]) is None


def test_ar_recovers_a_noiseless_ar1_and_needs_enough_history() -> None:
    series = [1.0]
    for _ in range(40):
        series.append(0.5 * series[-1] + 2.0)
    forecast = contestants.ar_forecast(series)
    assert forecast == pytest.approx(0.5 * series[-1] + 2.0, abs=1e-6)
    assert contestants.ar_forecast(series[:19]) is None


def test_survey_forecast_requires_publication_by_the_origin() -> None:
    survey = pl.DataFrame(
        {
            "survey_year": [2005], "survey_quarter": [2], "variable": ["gdp"], "horizon": [0],
            "statistic": ["median"], "value": [3.2],
            "known_from": [datetime(2005, 5, 20, 3, 59, 59, tzinfo=UTC)],
        },
    )
    assert contestants.spf_forecast(survey, date(2005, 4, 1), date(2005, 5, 18)) is None
    assert contestants.spf_forecast(survey, date(2005, 4, 1), date(2005, 5, 19)) == 3.2
    assert contestants.spf_forecast(survey, date(2005, 7, 1), date(2005, 8, 1)) is None


def test_ridge_waits_for_enough_released_answers() -> None:
    rng = np.random.default_rng(0)
    x = rng.normal(size=(30, 3))
    y = x @ np.array([1.0, -0.5, 0.2]) + 1.0
    release = [date(2010, 1, 1) + timedelta(days=30 * i) for i in range(30)]
    made_on = [r - timedelta(days=5) for r in release]
    early = contestants.ridge_forecast(x, y.tolist(), release, made_on, x[0], release[10])
    later = contestants.ridge_forecast(x, y.tolist(), release, made_on, x[29], release[29])
    assert early is None
    assert later == pytest.approx(float(y[29]), abs=0.5)


def test_conformal_half_width_uses_position_37_of_40() -> None:
    residuals = [float(i) for i in range(1, 41)]
    assert conformal.conformal_half_width(residuals) == 37.0
    assert conformal.conformal_half_width(residuals[:39]) is None
    assert conformal.conformal_half_width([-r for r in residuals]) == 37.0
    assert conformal.interval(10.0, 3.0) == (7.0, 13.0)
    assert conformal.interval(10.0, None) is None


def test_conformal_uses_only_the_last_forty_residuals() -> None:
    residuals = [100.0] * 5 + [float(i) for i in range(1, 41)]
    assert conformal.conformal_half_width(residuals) == 37.0


def test_intervals_use_only_residuals_whose_actual_was_public() -> None:
    rows = []
    for i in range(45):
        period = add_months(date(2000, 1, 1), i)
        rows.append({
            "target": "cpi", "period": period, "contestant": "naive",
            "made_on": period + timedelta(days=10), "value": 0.0, "actual": 1.0,
            "release_date": period + timedelta(days=45), "lo": None, "hi": None,
        })
    frame = pl.DataFrame(rows).with_columns(pl.col("period").cast(pl.Date))
    result = add_intervals(frame).sort("period")
    with_interval = result.drop_nulls(["lo", "hi"])
    assert with_interval.height < 5
    first = with_interval.row(0, named=True)
    visible = [
        r for r in rows if r["period"] < first["period"] and r["release_date"] <= first["made_on"]
    ]
    assert len(visible) >= 40


def test_arena_file_follows_the_contract_and_stays_point_in_time() -> None:
    observations = monthly_series("CPIAUCSL", random_walk(120))
    payload = export.build_arena(observations, None, date(2010, 6, 1))
    assert payload["schema_version"] == 1
    assert {t["id"] for t in payload["targets"]} == {"gdp", "cpi", "payrolls"}
    assert [c["id"] for c in payload["contestants"]] == [
        "naive", "ar", "ridge", "factor_ridge", "lasso",
    ]
    assert payload["leakage"] == []
    release = {
        (r["target"], r["period"].isoformat()): r["release_date"]
        for r in first_print_targets(observations).iter_rows(named=True)
    }
    for row in payload["forecasts"]:
        assert date.fromisoformat(row["made_on"]) < release[(row["target"], row["period"])]
        for band in row["intervals"].values():
            assert band["level"] == 0.9
            assert band["lo"] <= band["hi"]
    naive = [s for s in payload["scores"] if s["contestant"] == "naive" and s["window"] == "all"]
    assert naive[0]["dm_vs_naive_p"] is None
    text = json.dumps(payload).lower()
    assert "kalshi" not in text
    assert "kx" not in text
    assert payload["live"][0]["period"] == "2010-01-01"


def test_aci_coverage_hand_computed_sequence() -> None:
    # window=4, level=0.8, gamma=0.5, initial alpha=0.2, abs errors: [1,2,3,4, 0.5,0.5,3.5,10,1]
    # t=4: calib=[1,2,3,4], alpha=0.2, ceil(5*0.8)=4 -> hw=4.0, e=0.5 <= 4.0 -> miss=0, alpha=0.3
    # t=5: calib=[0.5,2,3,4], alpha=0.3, ceil(5*0.7)=4 -> hw=4.0, e=0.5 <= 4.0 -> miss=0, alpha=0.4
    # t=6: calib=[0.5,0.5,3,4], alpha=0.4, ceil(5*0.6)=3 -> hw=3.0, e=3.5 > 3.0 -> miss=1, alpha=0.0
    # t=7: calib=[0.5,0.5,3.5,4], alpha=0.0 <= 0 -> hw=inf, e=10.0 <= inf -> miss=0, alpha=0.1
    # t=8: calib=[0.5,0.5,3.5,10], alpha=0.1, ceil(5*0.9)=5 > 4 -> hw=inf, e=1.0 <= inf -> miss=0
    errors = [-1.0, 2.0, -3.0, 4.0, 0.5, -0.5, 3.5, -10.0, 1.0]
    result = conformal.aci_coverage(errors, level=0.8, gamma=0.5, window=4)
    assert result["n"] == 5
    assert result["coverage"] == pytest.approx(4 / 5)

    short = conformal.aci_coverage([1.0, 2.0, 3.0, 4.0], level=0.8, gamma=0.5, window=4)
    assert short == {"n": 0, "coverage": None}

    # alpha reaches 1.0 after repeated hits and remains bounded
    many_hits = conformal.aci_coverage(
        [1.0, 2.0, 3.0, 4.0, 0.1, 0.1, 0.1, 0.1], level=0.5, gamma=1.0, window=4,
    )
    assert many_hits["n"] == 4
    assert 0.0 <= float(many_hits["coverage"]) <= 1.0


def test_build_arena_keeps_existing_scores_unchanged_and_adds_new_fields() -> None:
    expected_existing = [
        {
            "target": "cpi", "contestant": "naive", "window": "all",
            "n": 118, "mae": 0.2025, "rmse": 0.2499, "coverage_90": 0.9359,
            "dm_vs_naive_p": None,
        },
        {
            "target": "cpi", "contestant": "naive", "window": "clean",
            "n": 118, "mae": 0.2025, "rmse": 0.2499, "coverage_90": 0.9359,
            "dm_vs_naive_p": None,
        },
        {
            "target": "cpi", "contestant": "ar", "window": "all",
            "n": 99, "mae": 0.1432, "rmse": 0.1798, "coverage_90": 0.9322,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "ar", "window": "clean",
            "n": 99, "mae": 0.1432, "rmse": 0.1798, "coverage_90": 0.9322,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "ridge", "window": "all",
            "n": 98, "mae": 0.1415, "rmse": 0.1779, "coverage_90": 0.931,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "ridge", "window": "clean",
            "n": 98, "mae": 0.1415, "rmse": 0.1779, "coverage_90": 0.931,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "factor_ridge", "window": "all",
            "n": 98, "mae": 0.1424, "rmse": 0.1784, "coverage_90": 0.9138,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "factor_ridge", "window": "clean",
            "n": 98, "mae": 0.1424, "rmse": 0.1784, "coverage_90": 0.9138,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "lasso", "window": "all",
            "n": 98, "mae": 0.1415, "rmse": 0.1792, "coverage_90": 0.931,
            "dm_vs_naive_p": 0.0,
        },
        {
            "target": "cpi", "contestant": "lasso", "window": "clean",
            "n": 98, "mae": 0.1415, "rmse": 0.1792, "coverage_90": 0.931,
            "dm_vs_naive_p": 0.0,
        },
    ]
    observations = monthly_series("CPIAUCSL", random_walk(120))
    payload = export.build_arena(observations, None, date(2010, 6, 1))
    scores = payload["scores"]
    expected_keys = [
        "target", "contestant", "window", "n", "mae", "rmse", "coverage_90", "dm_vs_naive_p",
        "n_intervals", "coverage_90_lo", "coverage_90_hi",
        "pinball_05", "pinball_50", "pinball_95", "aci_n", "aci_coverage_90",
        "crps", "crps_n",
    ]
    assert len(scores) == len(expected_existing)
    for row, baseline in zip(scores, expected_existing, strict=True):
        assert list(row.keys()) == expected_keys
        for key, val in baseline.items():
            assert row[key] == val
        assert isinstance(row["n_intervals"], int) and row["n_intervals"] > 0
        cov_lo = float(row["coverage_90_lo"])
        cov_mid = float(row["coverage_90"])
        cov_hi = float(row["coverage_90_hi"])
        assert 0.0 <= cov_lo <= cov_mid <= cov_hi <= 1.0
        assert float(row["pinball_05"]) >= 0.0
        assert float(row["pinball_50"]) >= 0.0
        assert float(row["pinball_95"]) >= 0.0
        assert row["aci_n"] == int(row["n"]) - 40
        assert 0.0 <= float(row["aci_coverage_90"]) <= 1.0
        assert float(row["crps"]) >= 0.0
        assert row["crps_n"] == row["n_intervals"]

    nested = payload["nested_tests"]
    assert [(r["target"], r["restricted"], r["larger"], r["window"]) for r in nested] == [
        ("cpi", "naive", "ar", "all"),
        ("cpi", "naive", "ar", "clean"),
        ("cpi", "ar", "ridge", "all"),
        ("cpi", "ar", "ridge", "clean"),
    ]
    for entry in nested:
        assert list(entry.keys()) == [
            "target", "restricted", "larger", "window", "n", "statistic", "p_value",
        ]
        assert isinstance(entry["n"], int) and entry["n"] >= 3
        assert 0.0 <= float(entry["p_value"]) <= 1.0


def test_build_arena_sets_null_interval_and_aci_fields_when_history_is_short() -> None:
    observations = monthly_series("CPIAUCSL", random_walk(21))
    payload = export.build_arena(observations, None, date(2002, 6, 1))
    assert payload["scores"]
    for row in payload["scores"]:
        assert row["n_intervals"] == 0
        assert row["coverage_90_lo"] is None
        assert row["coverage_90_hi"] is None
        assert row["pinball_05"] is None
        assert row["pinball_50"] is None
        assert row["pinball_95"] is None
        assert row["aci_n"] == 0
        assert row["aci_coverage_90"] is None
        assert row["crps"] is None
        assert row["crps_n"] is None
    assert payload["nested_tests"] == []
