from __future__ import annotations

import math

import pytest

from macro_event_lab.arena import metrics

LOSS1 = [0.45, 0.62, 0.38, 0.55, 0.70, 0.48, 0.65, 0.52, 0.40, 0.58, 0.61, 0.49]
LOSS2 = [0.35, 0.48, 0.42, 0.40, 0.51, 0.39, 0.45, 0.41, 0.44, 0.38, 0.46, 0.37]


def test_rmse_and_mae_of_a_hand_calculated_example() -> None:
    assert metrics.rmse([3.0, -4.0]) == pytest.approx(math.sqrt(12.5))
    assert metrics.mae([3.0, -4.0]) == 3.5
    assert metrics.rmse([]) is None
    assert metrics.mae([]) is None


def test_pinball_loss_penalizes_each_side_by_its_quantile() -> None:
    assert metrics.pinball_loss([2.0], [1.0], 0.9) == pytest.approx(0.9)
    assert metrics.pinball_loss([0.0], [1.0], 0.9) == pytest.approx(0.1)
    assert metrics.pinball_loss([], [], 0.5) is None


def test_coverage_counts_the_interval_ends_as_inside() -> None:
    value = metrics.coverage([1.0, 2.0, 5.0], [1.0, 1.0, 1.0], [2.0, 2.0, 2.0])
    assert value == pytest.approx(2 / 3)


def test_wilson_interval_for_nine_of_ten() -> None:
    low, high = metrics.wilson_interval(9, 10)
    assert low == pytest.approx(0.5958, abs=1e-3)
    assert high == pytest.approx(0.9821, abs=1e-3)


def test_student_t_cdf_known_values_and_symmetry() -> None:
    assert metrics.student_t_cdf(2.228139, 10) == pytest.approx(0.975, abs=1e-5)
    assert metrics.student_t_cdf(0.0, 7) == pytest.approx(0.5)
    assert metrics.student_t_cdf(-1.3, 5) == pytest.approx(1 - metrics.student_t_cdf(1.3, 5))
    assert metrics.student_t_cdf(1.0, 1) == pytest.approx(0.75, abs=1e-9)


def test_dm_test_matches_the_reference_example() -> None:
    result = metrics.dm_test(LOSS1, LOSS2)
    assert result is not None
    assert result["mean_difference"] == pytest.approx(0.11416667, abs=1e-8)
    assert result["statistic"] == pytest.approx(5.10244150, abs=1e-6)
    assert result["corrected_statistic"] == pytest.approx(4.88521581, abs=1e-6)
    assert result["p_value"] == pytest.approx(0.00048285, abs=1e-7)


def test_dm_test_changes_sign_when_the_series_are_swapped() -> None:
    forward = metrics.dm_test(LOSS1, LOSS2)
    backward = metrics.dm_test(LOSS2, LOSS1)
    assert forward is not None
    assert backward is not None
    assert backward["statistic"] == pytest.approx(-forward["statistic"])
    assert backward["p_value"] == pytest.approx(forward["p_value"])


def test_dm_test_with_longer_horizon_uses_bartlett_weights() -> None:
    result = metrics.dm_test(LOSS1, LOSS2, horizon=2)
    assert result is not None
    expected = 0.11416667 / math.sqrt(0.00428050 / 12)
    assert result["statistic"] == pytest.approx(expected, abs=1e-5)


def test_dm_test_returns_none_for_identical_or_short_series() -> None:
    assert metrics.dm_test(LOSS1, LOSS1) is None
    assert metrics.dm_test([1.0, 2.0], [2.0, 1.0]) is None
    with pytest.raises(ValueError):
        metrics.dm_test(LOSS1, LOSS2, horizon=0)
