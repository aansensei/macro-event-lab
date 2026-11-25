"""Forecast accuracy measures and the Diebold and Mariano test of equal squared error."""

from __future__ import annotations

import math
from collections.abc import Sequence


def rmse(errors: Sequence[float]) -> float | None:
    return math.sqrt(sum(e * e for e in errors) / len(errors)) if errors else None


def mae(errors: Sequence[float]) -> float | None:
    return sum(abs(e) for e in errors) / len(errors) if errors else None


def pinball_loss(actuals: Sequence[float], quantiles: Sequence[float], tau: float) -> float | None:
    """Mean pinball loss of one quantile forecast per actual at probability tau."""
    if not actuals or len(actuals) != len(quantiles):
        return None
    total = 0.0
    for y, q in zip(actuals, quantiles, strict=True):
        total += max(tau * (y - q), (tau - 1.0) * (y - q))
    return total / len(actuals)


# published numbers move in steps of 0.1, so an actual often sits exactly on an interval edge and
# floating point noise of about 1e-16 must not decide whether it counts as inside
EDGE_TOLERANCE = 1e-9


def inside(actual: float, low: float, high: float) -> bool:
    """Whether the actual is in the closed interval, edges included up to floating point noise."""
    return low - EDGE_TOLERANCE <= actual <= high + EDGE_TOLERANCE


def coverage(
    actuals: Sequence[float], lows: Sequence[float], highs: Sequence[float],
) -> float | None:
    """Share of actuals inside the closed interval."""
    if not actuals:
        return None
    hits = sum(inside(y, lo, hi) for y, lo, hi in zip(actuals, lows, highs, strict=True))
    return hits / len(actuals)


def wilson_interval(successes: int, trials: int, z: float = 1.959964) -> tuple[float, float]:
    """Wilson score interval for a proportion."""
    if trials <= 0:
        raise ValueError("trials must be positive")
    p = successes / trials
    denominator = 1 + z * z / trials
    center = (p + z * z / (2 * trials)) / denominator
    half = z * math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / denominator
    # clamp floating point overshoot at the 0 and 1 boundaries so the interval stays in [0, 1]
    low = 0.0 if successes == 0 else max(0.0, center - half)
    high = 1.0 if successes == trials else min(1.0, center + half)
    return low, high


def _beta_continued_fraction(a: float, b: float, x: float) -> float:
    tiny = 1e-300
    qab, qap, qam = a + b, a + 1.0, a - 1.0
    c, d = 1.0, 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 400):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-14:
            break
    return h


def regularized_beta(a: float, b: float, x: float) -> float:
    """Regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    log_front = (
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    )
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(log_front) * _beta_continued_fraction(a, b, x) / a
    return 1.0 - math.exp(log_front) * _beta_continued_fraction(b, a, 1.0 - x) / b


def student_t_cdf(t: float, df: float) -> float:
    tail = 0.5 * regularized_beta(df / 2.0, 0.5, df / (df + t * t))
    return 1.0 - tail if t >= 0 else tail


def dm_test(
    loss_a: Sequence[float], loss_b: Sequence[float], horizon: int = 1,
) -> dict[str, float | int] | None:
    """Diebold and Mariano test with Newey and West variance and the Harvey correction.

    The loss differential is loss_a minus loss_b, so a positive statistic means contestant a
    lost more. Returns None when the sample is too short or the variance is not positive.
    """
    if horizon < 1:
        raise ValueError("horizon must be at least 1")
    if len(loss_a) != len(loss_b):
        raise ValueError("loss series must have the same length")
    n = len(loss_a)
    if n < 3:
        return None
    d = [a - b for a, b in zip(loss_a, loss_b, strict=True)]
    mean = sum(d) / n

    def autocovariance(lag: int) -> float:
        return sum((d[t] - mean) * (d[t - lag] - mean) for t in range(lag, n)) / n

    variance = autocovariance(0)
    for lag in range(1, horizon):
        variance += 2.0 * (1.0 - lag / horizon) * autocovariance(lag)
    if variance <= 1e-15:
        return None
    statistic = mean / math.sqrt(variance / n)
    factor = math.sqrt((n + 1 - 2 * horizon + horizon * (horizon - 1) / n) / n)
    corrected = factor * statistic
    p_value = 2.0 * (1.0 - student_t_cdf(abs(corrected), n - 1))
    return {
        "n": n, "mean_difference": mean, "statistic": statistic,
        "corrected_statistic": corrected, "p_value": p_value,
    }


def clark_west_test(
    restricted_forecasts: Sequence[float],
    larger_forecasts: Sequence[float],
    actuals: Sequence[float],
) -> dict[str, float | int] | None:
    """One sided Clark and West adjusted test of equal forecast accuracy for nested models.

    Positive statistics favor the larger model; p_value is the Student t upper tail.
    """
    if len(restricted_forecasts) != len(larger_forecasts) or len(restricted_forecasts) != len(
        actuals
    ):
        raise ValueError("forecast and actual series must have the same length")
    n = len(actuals)
    if n < 3:
        return None
    adjusted: list[float] = []
    for yhat_r, yhat_l, y in zip(restricted_forecasts, larger_forecasts, actuals, strict=True):
        err_r = y - yhat_r
        err_l = y - yhat_l
        adjusted.append(err_r * err_r - (err_l * err_l - (yhat_r - yhat_l) ** 2))
    mean_f = sum(adjusted) / n
    # divide by n to match the sample variance convention of dm_test above
    variance = sum((val - mean_f) ** 2 for val in adjusted) / n
    if variance <= 1e-15:
        return None
    statistic = mean_f / math.sqrt(variance / n)
    p_value = 1.0 - student_t_cdf(statistic, n - 1)
    return {"statistic": statistic, "p_value": p_value, "n": n}
