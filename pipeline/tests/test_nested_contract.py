from __future__ import annotations

import math
from datetime import date

import numpy as np
import polars as pl
import pytest

from macro_event_lab.arena import export, metrics
from macro_event_lab.arena.targets import add_months

OBSERVATION_SCHEMA = {
    "series_id": pl.String,
    "observation_date": pl.Date,
    "value": pl.Float64,
    "realtime_start": pl.Date,
    "realtime_end": pl.Date,
}

EXPECTED_NESTED_KEYS = [
    "target",
    "restricted",
    "larger",
    "window",
    "n",
    "statistic",
    "p_value",
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


def test_clark_west_hand_computed_positive_statistic() -> None:
    # actuals = [2, 4, 6, 8]
    # restricted = [1, 2, 4, 6] => e_r = [1, 2, 2, 2], e_r^2 = [1, 4, 4, 4]
    # larger = [2, 3, 5, 7] => e_l = [0, 1, 1, 1], e_l^2 = [0, 1, 1, 1]
    # (yhat_r - yhat_l) = [-1, -1, -1, -1] => squared = [1, 1, 1, 1]
    # f = [1 - (0 - 1), 4 - (1 - 1), 4 - (1 - 1), 4 - (1 - 1)] = [2, 4, 4, 4]
    # mean(f) = 14 / 4 = 3.5
    # deviations = [-1.5, 0.5, 0.5, 0.5], sum of squares = 2.25 + 0.25 + 0.25 + 0.25 = 3.0
    # var(f) = 3.0 / 4 = 0.75 (divisor n, matching dm_test)
    # statistic = 3.5 / sqrt(0.75 / 4) = 14 / sqrt(3)
    # p_value = 1 - student_t_cdf(14 / sqrt(3), df=3)
    actuals = [2.0, 4.0, 6.0, 8.0]
    restricted = [1.0, 2.0, 4.0, 6.0]
    larger = [2.0, 3.0, 5.0, 7.0]
    result = metrics.clark_west_test(restricted, larger, actuals)
    assert result is not None
    assert set(result.keys()) == {"statistic", "p_value", "n"}
    assert result["n"] == 4
    expected_stat = 14.0 / math.sqrt(3.0)
    expected_p = 1.0 - metrics.student_t_cdf(expected_stat, 3)
    assert result["statistic"] == pytest.approx(expected_stat, rel=1e-9)
    assert result["p_value"] == pytest.approx(expected_p, rel=1e-9)


def test_clark_west_one_sided_negative_statistic() -> None:
    # actuals = [1, 2, 2, 2]
    # restricted = [1.5, 2.5, 2.5, 2.5] => e_r = [-0.5, ...], e_r^2 = [0.25, ...]
    # larger = [3.5, 4.5, 4.5, 5.5] => e_l = [-2.5, -2.5, -2.5, -3.5], e_l^2 = [6.25, ..., 12.25]
    # (yhat_r - yhat_l)^2 = [4, 4, 4, 9]
    # f = [-2.0, -2.0, -2.0, -3.0], mean(f) = -2.25
    # deviations = [0.25, 0.25, 0.25, -0.75], sum of squares = 0.75, var(f) = 0.75 / 4 = 0.1875
    # statistic = -2.25 / sqrt(0.1875 / 4) = -6 * sqrt(3)
    # p_value = 1 - student_t_cdf(-6 * sqrt(3), df=3) > 0.5 (one sided)
    actuals = [1.0, 2.0, 2.0, 2.0]
    restricted = [1.5, 2.5, 2.5, 2.5]
    larger = [3.5, 4.5, 4.5, 5.5]
    result = metrics.clark_west_test(restricted, larger, actuals)
    assert result is not None
    expected_stat = -6.0 * math.sqrt(3.0)
    expected_p = 1.0 - metrics.student_t_cdf(expected_stat, 3)
    assert result["n"] == 4
    assert result["statistic"] == pytest.approx(expected_stat, rel=1e-9)
    assert result["p_value"] == pytest.approx(expected_p, rel=1e-9)
    assert result["p_value"] > 0.5


def test_clark_west_returns_none_for_short_or_zero_variance() -> None:
    assert metrics.clark_west_test([], [], []) is None
    assert metrics.clark_west_test([1.0, 2.0], [1.5, 2.5], [1.0, 2.0]) is None
    assert metrics.clark_west_test([1.0, 2.0, 3.0], [1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) is None
    # Constant f_t = 2.0 across three pairs gives zero variance
    assert metrics.clark_west_test([1.0, 1.0, 1.0], [2.0, 2.0, 2.0], [2.0, 2.0, 2.0]) is None


def test_arena_nested_tests_pairs_windows_and_values() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(60))
    payload = export.build_arena(observations, None, date(2005, 6, 1))
    assert "nested_tests" in payload
    nested = payload["nested_tests"]
    assert isinstance(nested, list)
    assert len(nested) > 0

    for entry in nested:
        assert list(entry.keys()) == EXPECTED_NESTED_KEYS

    keys_seen = {
        (e["target"], e["restricted"], e["larger"], e["window"]) for e in nested
    }
    expected_keys = {
        ("cpi", "naive", "ar", "all"),
        ("cpi", "naive", "ar", "clean"),
        ("cpi", "ar", "ridge", "all"),
        ("cpi", "ar", "ridge", "clean"),
    }
    assert keys_seen == expected_keys

    by_period = {
        (row["target"], row["period"]): row for row in payload["forecasts"]
    }
    for entry in nested:
        r_name = entry["restricted"]
        l_name = entry["larger"]
        aligned = [
            by_period[key]
            for key in sorted(by_period)
            if key[0] == entry["target"]
            and by_period[key]["actual"] is not None
            and r_name in by_period[key]["values"]
            and l_name in by_period[key]["values"]
        ]
        assert entry["n"] == len(aligned)
        cw = metrics.clark_west_test(
            [row["values"][r_name] for row in aligned],
            [row["values"][l_name] for row in aligned],
            [row["actual"] for row in aligned],
        )
        assert cw is not None
        assert entry["statistic"] == pytest.approx(cw["statistic"], abs=1e-3)
        assert entry["p_value"] == pytest.approx(cw["p_value"], abs=1e-3)


def test_arena_nested_tests_excludes_pairs_when_larger_contestant_missing() -> None:
    observations = _monthly_series("CPIAUCSL", _random_walk(15))
    payload = export.build_arena(observations, None, date(2001, 6, 1))
    assert "nested_tests" in payload
    assert payload["nested_tests"] == []
