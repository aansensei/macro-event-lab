from __future__ import annotations

import pytest

from macro_event_lab.arena import conformal


def test_aci_coverage_hand_computed_sequence_with_moving_alpha() -> None:
    # window = 5, level = 0.8 (initial alpha = 0.2), gamma = 0.25
    # Signed errors: first 5 fill calibration, next 11 are scored.
    # Absolute errors:
    # cal[0:5] = [1.0, 2.0, 3.0, 4.0, 5.0]
    # t=5, e=4.5: sorted=[1,2,3,4,5], alpha=0.20, pos=ceil(6*0.8)=5, hw=5.0
    #   hit (miss=0), alpha = 0.20 + 0.25 * 0.2 = 0.25
    # t=6, e=6.0: sorted=[2,3,4,4.5,5], alpha=0.25, pos=ceil(6*0.75)=5, hw=5.0
    #   miss=1, alpha = 0.25 + 0.25 * (-0.8) = 0.05
    # t=7, e=10.0: sorted=[3,4,4.5,5,6], alpha=0.05, pos=ceil(6*0.95)=6>5
    #   hw=inf, miss=0, alpha = 0.05 + 0.05 = 0.10
    # t=8, e=10.0: alpha=0.10, pos=ceil(6*0.90)=6>5 => hw=inf, miss=0, alpha=0.15
    # t=9, e=10.0: alpha=0.15, pos=ceil(6*0.85)=6>5 => hw=inf, miss=0, alpha=0.20
    # t=10, e=4.5: cal=[4.5,6,10,10,10], alpha=0.20, pos=ceil(6*0.80)=5, hw=10.0
    #   miss=0, alpha=0.25
    # t=11, e=6.0: sorted=[4.5,6,10,10,10], alpha=0.25, pos=5, hw=10.0 => miss=0, alpha=0.30
    # t=12, e=6.0: sorted=[4.5,6,10,10,10], alpha=0.30, pos=ceil(6*0.70)=5, hw=10.0
    #   miss=0, alpha=0.35
    # t=13, e=7.0: sorted=[4.5,6,6,10,10], alpha=0.35, pos=ceil(6*0.65)=4, hw=10.0
    #   miss=0, alpha=0.40
    # t=14, e=6.0: sorted=[4.5,6,6,7,10], alpha=0.40, pos=ceil(6*0.60)=4, hw=7.0
    #   miss=0, alpha=0.45
    # t=15, e=6.5: sorted=[4.5,6,6,6,7], alpha=0.45, pos=ceil(6*0.55)=4, hw=6.0
    #   miss=1, alpha=0.25
    # Scored errors: 11, misses: 2 (at t=6 and t=15), hits: 9, coverage = 9 / 11
    errors = [
        -1.0, 2.0, -3.0, 4.0, -5.0,
        4.5, -6.0, 10.0, -10.0, 10.0, -4.5, 6.0, -6.0, 7.0, -6.0, 6.5,
    ]
    result = conformal.aci_coverage(errors, level=0.8, gamma=0.25, window=5)
    assert result["n"] == 11
    assert result["coverage"] == pytest.approx(9 / 11, rel=1e-12)


def test_aci_coverage_clamps_alpha_at_zero_and_uses_infinite_width() -> None:
    # window = 5, level = 0.8 (initial alpha = 0.2), gamma = 0.5
    # cal[0:5] = [1.0, 2.0, 3.0, 4.0, 5.0]
    # t=5, e=6.0: pos=5, hw=5.0 => miss=1, raw alpha = 0.2 + 0.5*(0.2-1) = -0.2 => clamped to 0.0
    # t=6, e=7.0: alpha=0.0 <= 0 => hw=inf => miss=0, alpha = 0.0 + 0.5*0.2 = 0.1
    # t=7, e=7.5: alpha=0.1, pos=ceil(6*0.9)=6>5 => hw=inf => miss=0, alpha = 0.1 + 0.1 = 0.2
    # t=8, e=8.0: cal=[4.0, 5.0, 6.0, 7.0, 7.5], alpha=0.2, pos=ceil(6*0.8)=5, hw=7.5 => miss=1
    # Without clamping at 0.0, alpha at t=8 would be 0.0 and t=8 would not miss.
    # Scored errors: 4, misses: 2 (t=5 and t=8), hits: 2, coverage = 2 / 4 = 0.5
    errors = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 7.5, 8.0]
    result = conformal.aci_coverage(errors, level=0.8, gamma=0.5, window=5)
    assert result["n"] == 4
    assert result["coverage"] == pytest.approx(0.5, rel=1e-12)


def test_aci_coverage_boundary_equality_is_not_a_miss() -> None:
    # window = 5, level = 0.8, pos = 5, half_width = 5.0, e_5 = 5.0 is not > 5.0
    errors = [1.0, 2.0, 3.0, 4.0, 5.0, -5.0]
    result = conformal.aci_coverage(errors, level=0.8, gamma=0.1, window=5)
    assert result["n"] == 1
    assert result["coverage"] == pytest.approx(1.0)


def test_aci_coverage_default_parameters_and_short_series() -> None:
    assert conformal.aci_coverage([]) == {"n": 0, "coverage": None}
    assert conformal.aci_coverage([1.0] * 40) == {"n": 0, "coverage": None}

    # Default level=0.9, gamma=0.01, window=40
    # cal[0:40] = [1..40]
    # t=40, e=37.0: alpha=0.1, pos=ceil(41*0.9)=37, hw=37.0 => hit (miss=0), alpha=0.101
    # t=41, e=38.0: sorted=[2..37, 37, 38, 39, 40], pos=ceil(41*0.899)=37, hw=37.0
    #   miss=1, alpha=0.092
    # t=42, e=1.0: cal=[3..40, 37, 38], pos=ceil(41*0.908)=38, hw=38.0 => hit (miss=0)
    errors = [float(i) for i in range(1, 41)] + [37.0, -38.0, 1.0]
    result = conformal.aci_coverage(errors)
    assert result["n"] == 3
    assert result["coverage"] == pytest.approx(2 / 3, rel=1e-12)
