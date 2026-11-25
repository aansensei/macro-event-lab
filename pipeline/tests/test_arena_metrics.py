from __future__ import annotations

import math

import pytest
from hypothesis import given
from hypothesis import strategies as st

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


def test_pinball_loss_at_three_levels() -> None:
    actuals = [1.0, 3.0]
    quantiles = [2.0, 1.0]
    assert metrics.pinball_loss(actuals, quantiles, 0.05) == pytest.approx((0.95 + 0.10) / 2)
    assert metrics.pinball_loss(actuals, quantiles, 0.5) == pytest.approx((0.50 + 1.00) / 2)
    assert metrics.pinball_loss(actuals, quantiles, 0.95) == pytest.approx((0.05 + 1.90) / 2)


@given(
    pairs=st.lists(
        st.tuples(
            st.floats(min_value=-1e4, max_value=1e4, allow_nan=False, allow_infinity=False),
            st.floats(min_value=-1e4, max_value=1e4, allow_nan=False, allow_infinity=False),
        ),
        min_size=1,
        max_size=40,
    ),
    tau=st.sampled_from([0.05, 0.5, 0.95]),
)
def test_pinball_loss_is_never_negative(
    pairs: list[tuple[float, float]], tau: float,
) -> None:
    actuals = [y for y, _ in pairs]
    quantiles = [q for _, q in pairs]
    loss = metrics.pinball_loss(actuals, quantiles, tau)
    assert loss is not None
    assert loss >= 0.0


def test_wilson_interval_boundaries() -> None:
    z = 1.959964
    low_zero, high_zero = metrics.wilson_interval(0, 10)
    assert low_zero == 0.0
    assert high_zero == pytest.approx((z * z) / (10 + z * z), abs=1e-12)

    low_all, high_all = metrics.wilson_interval(10, 10)
    assert low_all == pytest.approx(10 / (10 + z * z), abs=1e-12)
    assert high_all == 1.0

    with pytest.raises(ValueError):
        metrics.wilson_interval(0, 0)


@given(trials=st.integers(min_value=1, max_value=500), data=st.data())
def test_wilson_interval_contains_share_and_stays_within_unit_interval(
    trials: int, data: st.DataObject,
) -> None:
    successes = data.draw(st.integers(min_value=0, max_value=trials))
    low, high = metrics.wilson_interval(successes, trials)
    share = successes / trials
    assert 0.0 <= low <= share <= high <= 1.0


def test_clark_west_test_hand_computed() -> None:
    # t=0: (2-1)^2 - ((2-2)^2 - (1-2)^2) = 1 - (0 - 1) = 2
    # t=1: (4-2)^2 - ((4-3)^2 - (2-3)^2) = 4 - (1 - 1) = 4
    # t=2: (1-2)^2 - ((1-1)^2 - (2-1)^2) = 1 - (0 - 1) = 2
    # t=3: (3-1)^2 - ((3-2)^2 - (1-2)^2) = 4 - (1 - 1) = 4
    # mean = (2 + 4 + 2 + 4) / 4 = 3.0; var = (1 + 1 + 1 + 1) / 4 = 1.0
    # statistic = 3.0 / sqrt(1.0 / 4) = 6.0; df = 3
    actuals = [2.0, 4.0, 1.0, 3.0]
    restricted = [1.0, 2.0, 2.0, 1.0]
    larger = [2.0, 3.0, 1.0, 2.0]
    result = metrics.clark_west_test(restricted, larger, actuals)
    assert result is not None
    assert result["n"] == 4
    assert result["statistic"] == pytest.approx(6.0, abs=1e-12)
    assert result["p_value"] == pytest.approx(1.0 - metrics.student_t_cdf(6.0, 3), abs=1e-12)
    assert 0.004 < float(result["p_value"]) < 0.005


def test_clark_west_test_edge_cases() -> None:
    assert metrics.clark_west_test([1.0, 2.0], [1.5, 2.5], [1.0, 2.0]) is None
    assert metrics.clark_west_test([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], [2.0, 3.0, 4.0]) is None
    with pytest.raises(ValueError):
        metrics.clark_west_test([1.0, 2.0], [1.0], [1.0, 2.0])


@given(
    pairs=st.lists(
        st.tuples(
            st.floats(min_value=-1e3, max_value=1e3, allow_nan=False, allow_infinity=False),
            st.floats(min_value=-1e3, max_value=1e3, allow_nan=False, allow_infinity=False),
        ),
        min_size=3,
        max_size=30,
    ),
)
def test_clark_west_identical_forecasts_return_none(
    pairs: list[tuple[float, float]],
) -> None:
    forecasts = [f for f, _ in pairs]
    actuals = [y for _, y in pairs]
    assert metrics.clark_west_test(forecasts, forecasts, actuals) is None


def test_inside_counts_an_actual_on_the_edge_despite_floating_point_noise() -> None:
    # 0.2 - 0.7 is -0.49999999999999994 in floating point, one step above the actual -0.5
    low = 0.2 - 0.7
    assert low > -0.5
    assert metrics.inside(-0.5, low, 0.9)
    assert metrics.inside(0.9, low, 0.2 + 0.7)
    assert not metrics.inside(-0.5001, low, 0.9)
    assert not metrics.inside(0.9001, low, 0.9)
    assert metrics.coverage([-0.5, 2.0], [low, 0.0], [0.9, 1.0]) == 0.5


def test_crps_sample_hand_computed_and_empty() -> None:
    # samples [1.0, 4.0], actual 2.0:
    # mean(|y_j - a|) = (|1.0 - 2.0| + |4.0 - 2.0|) / 2 = (1.0 + 2.0) / 2 = 1.5
    # sum_i sum_j |y_i - y_j| = 0 + |1.0 - 4.0| + |4.0 - 1.0| + 0 = 6.0
    # penalty = (1 / (2 * 2^2)) * 6.0 = 6.0 / 8.0 = 0.75
    # crps = 1.5 - 0.75 = 0.75
    assert metrics.crps_sample([1.0, 4.0], 2.0) == pytest.approx(0.75)
    assert metrics.crps_sample([], 2.0) is None


def test_crps_sample_zero_when_repeated_actual() -> None:
    assert metrics.crps_sample([2.5, 2.5, 2.5], 2.5) == 0.0
    assert metrics.crps_sample([275000.0] * 40, 275000.0) == 0.0


def test_crps_sample_large_sample_matches_pairwise_formula() -> None:
    samples = [float(i % 7) for i in range(250)]
    actual = 3.2
    n = len(samples)
    term1 = sum(abs(y - actual) for y in samples) / n
    term2 = sum(abs(a - b) for a in samples for b in samples) / (2 * n * n)
    assert metrics.crps_sample(samples, actual) == pytest.approx(term1 - term2, abs=1e-12)


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
