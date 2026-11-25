from __future__ import annotations

from datetime import date, timedelta

import polars as pl
import pytest

from macro_event_lab.arena import calibration
from macro_event_lab.arena.harness import FORECAST_SCHEMA


def _month(index: int) -> date:
    year, month = divmod(index, 12)
    return date(2000 + year, month + 1, 1)


def _frame(errors: list[float]) -> pl.DataFrame:
    """One contestant on one target: forecast 100 and actual 100 plus the given error."""
    rows = []
    for index, error in enumerate(errors):
        period = _month(index)
        rows.append({
            "target": "cpi", "period": period, "contestant": "ar",
            "made_on": period - timedelta(days=5), "value": 100.0, "actual": 100.0 + error,
            "release_date": period + timedelta(days=5), "lo": None, "hi": None,
        })
    return pl.DataFrame(rows, schema=FORECAST_SCHEMA, orient="row")


def test_calibration_counts_hits_for_each_level_on_a_hand_built_history() -> None:
    # 40 errors of plus and minus 1 give a half width of 1 at every level, then one on the edge
    # and one outside
    errors = [1.0 if i % 2 == 0 else -1.0 for i in range(40)] + [1.0, 2.0]
    rows = calibration.calibration_rows(_frame(errors))
    assert [(r["level"], r["n"]) for r in rows] == [(0.5, 2), (0.8, 2), (0.9, 2)]
    for row in rows:
        assert row["coverage"] == pytest.approx(0.5)
        assert 0.0 <= row["coverage_lo"] <= 0.5 <= row["coverage_hi"] <= 1.0


def test_calibration_skips_origins_with_fewer_than_forty_known_errors() -> None:
    assert calibration.calibration_rows(_frame([1.0] * 40)) == []


def test_calibration_uses_only_errors_that_were_public_at_the_origin() -> None:
    # every actual is released long after its origin, so no origin ever has 40 public errors
    frame = _frame([1.0] * 60).with_columns(release_date=pl.col("period") + pl.duration(days=4000))
    assert calibration.calibration_rows(frame) == []


def test_predictive_quantiles_interpolate_the_sorted_errors() -> None:
    residuals = [float(i) for i in range(1, 41)]
    out = calibration.predictive_quantiles(100.0, residuals)
    assert out is not None and len(out) == 19
    # position (40 - 1) * 0.5 = 19.5 lies between 20 and 21
    assert out[9] == pytest.approx(120.5)
    # position 39 * 0.05 = 1.95 lies between 2 and 3
    assert out[0] == pytest.approx(100.0 + 2.95)
    assert out == sorted(out)


def test_predictive_quantiles_need_a_full_window_and_use_only_the_latest_errors() -> None:
    assert calibration.predictive_quantiles(100.0, [1.0] * 39) is None
    old_then_new = [1000.0] * 5 + [float(i) for i in range(1, 41)]
    latest = [float(i) for i in range(1, 41)]
    assert calibration.predictive_quantiles(100.0, old_then_new) == (
        calibration.predictive_quantiles(100.0, latest)
    )


def test_live_residuals_keep_only_released_errors_in_period_order() -> None:
    frame = _frame([3.0, -2.0, 5.0])
    as_of = _month(1) + timedelta(days=6)
    assert calibration.live_residuals(frame, "cpi", "ar", as_of) == [3.0, -2.0]
    assert calibration.live_residuals(frame, "gdp", "ar", as_of) == []
