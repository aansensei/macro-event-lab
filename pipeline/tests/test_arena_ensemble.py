import math
from datetime import date

import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab.arena.ensemble import add_ensemble, ensemble_forecast, ensemble_weights
from macro_event_lab.arena.harness import FORECAST_SCHEMA, add_intervals


def history(naive_error=3.0, ar_error=1.0, count=40):
    rows = []
    for i in range(count):
        period = date(2000 + i // 12, i % 12 + 1, 1)
        for model, error in [("naive", naive_error), ("ar", ar_error)]:
            rows.append(
                {
                    "target": "cpi",
                    "period": period,
                    "made_on": period,
                    "release_date": period,
                    "contestant": model,
                    "value": -error,
                    "actual": 0.0,
                    "lo": None,
                    "hi": None,
                }
            )
    return pl.DataFrame(rows, schema=FORECAST_SCHEMA)


def test_two_experts_have_hand_computed_clipped_weights_and_intervals():
    frame = history()
    values = {"naive": 0.0, "ar": 4.0}
    weights = ensemble_weights(frame, "cpi", date(2005, 1, 1), date(2005, 1, 1), values)
    eta = math.sqrt(8 * math.log(2) / 40)
    # Naive loss is 40 * 9 / 81, AR loss is 40 * 1 / 81.
    a, b = math.exp(-eta * 40 / 9), math.exp(-eta * 40 / 81)
    assert weights == pytest.approx({"naive": a / (a + b), "ar": b / (a + b)})
    assert ensemble_forecast(
        frame, "cpi", date(2005, 1, 1), date(2005, 1, 1), values
    ) == pytest.approx(4 * b / (a + b))
    joined = add_intervals(add_ensemble(frame))
    assert joined.filter(pl.col("contestant") == "ensemble").height == 28
    long = add_intervals(add_ensemble(history(count=70)))
    assert long.filter((pl.col("contestant") == "ensemble") & pl.col("lo").is_not_null()).height > 0


def test_threshold_equal_weights_and_clipping():
    period = date(2005, 1, 1)
    assert ensemble_weights(history(count=11), "cpi", period, period, {"naive": 0, "ar": 4}) == {}
    assert ensemble_weights(
        history(naive_error=0), "cpi", period, period, {"naive": 0, "ar": 4}
    ) == {"naive": 0.5, "ar": 0.5}
    one = ensemble_weights(history(ar_error=100), "cpi", period, period, {"naive": 0, "ar": 4})
    two = ensemble_weights(history(ar_error=10000), "cpi", period, period, {"naive": 0, "ar": 4})
    assert one == two
    assert ensemble_forecast(history(), "cpi", period, period, {"naive": 0}) is None


def test_unpublished_actuals_and_forecasts_do_not_change_earlier_weights():
    frame = history(count=70)
    period, origin = date(2003, 1, 1), date(2003, 1, 1)
    values = {"naive": 2.0, "ar": 3.0}
    expected = ensemble_forecast(frame, "cpi", period, origin, values)
    changed = frame.with_columns(
        pl.when(pl.col("release_date") > origin)
        .then(1e10)
        .otherwise(pl.col("actual"))
        .alias("actual"),
        pl.when(pl.col("release_date") > origin)
        .then(-1e10)
        .otherwise(pl.col("value"))
        .alias("value"),
    )
    assert ensemble_forecast(changed, "cpi", period, origin, values) == expected
    assert add_ensemble(pl.DataFrame(schema=FORECAST_SCHEMA)).is_empty()


def test_three_experts_and_missing_naive_history():
    frame = history()
    third = frame.filter(pl.col("contestant") == "ar").with_columns(
        pl.lit("ridge").alias("contestant"), pl.lit(-2.0).alias("value"),
    )
    frame = pl.concat([frame, third])
    period = date(2005, 1, 1)
    values = {"naive": 1.0, "ar": 2.0, "ridge": 3.0}
    weights = ensemble_weights(frame, "cpi", period, period, values)
    eta = math.sqrt(8 * math.log(3) / 40)
    raw = {"naive": math.exp(-eta * 40 / 9), "ar": math.exp(-eta * 40 / 81),
           "ridge": math.exp(-eta * 40 * 4 / 81)}
    expected = {name: value / sum(raw.values()) for name, value in raw.items()}
    assert weights == pytest.approx(expected)
    missing = frame.filter(pl.col("contestant") != "naive")
    assert ensemble_weights(missing, "cpi", period, period, values) == {"ar": 0.5, "ridge": 0.5}


@given(st.floats(-100, 100), st.floats(-100, 100))
def test_weights_are_positive_and_forecast_stays_between_experts(a, b):
    period = date(2005, 1, 1)
    values = {"naive": a, "ar": b}
    weights = ensemble_weights(history(), "cpi", period, period, values)
    assert sum(weights.values()) == pytest.approx(1)
    assert all(w > 0 for w in weights.values())
    result = ensemble_forecast(history(), "cpi", period, period, values)
    assert min(a, b) - 1e-10 <= result <= max(a, b) + 1e-10
