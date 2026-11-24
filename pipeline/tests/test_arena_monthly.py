from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import polars as pl
import pytest

from macro_event_lab.arena import contestants
from macro_event_lab.arena.harness import run_walk_forward
from macro_event_lab.arena.targets import add_months, build_origins, first_print_targets

OBSERVATION_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}
SERIES = ("CPIAUCSL", "PAYEMS", "INDPRO", "PCEC96", "RRSFS", "HOUST", "UNRATE")
MONTHS = 48


def levels(seed: int, base: float, drift: float) -> list[float]:
    rng = np.random.default_rng(seed)
    return list(base * np.cumprod(1 + rng.normal(drift, 0.004, MONTHS)))


def monthly(series_id: str, values: list[float]) -> pl.DataFrame:
    """Each month is published on the 15th of the next month and never revised."""
    rows = []
    for i, value in enumerate(values):
        period = add_months(date(2000, 1, 1), i)
        rows.append((series_id, period, value, add_months(period, 1).replace(day=15), None))
    return pl.DataFrame(rows, schema=OBSERVATION_SCHEMA, orient="row")


def panel() -> pl.DataFrame:
    return pl.concat([
        monthly(series, levels(i, 100.0 + 50 * i, 0.002 + 0.0003 * i))
        for i, series in enumerate(SERIES)
    ])


def tables(observations: pl.DataFrame) -> tuple[pl.DataFrame, pl.DataFrame]:
    targets = first_print_targets(observations)
    return targets, build_origins(targets, None)


def features_for(observations: pl.DataFrame, target: str) -> dict[date, np.ndarray]:
    targets, origins = tables(observations)
    mine = origins.filter(pl.col("target") == target)
    return contestants.monthly_features(observations, targets, mine, target)


def test_monthly_feature_names_match_the_vector_length_and_drop_the_target_series() -> None:
    observations = panel()
    for target in ("cpi", "payrolls"):
        vectors = features_for(observations, target)
        names = contestants.monthly_feature_names(target)
        assert vectors and all(len(vector) == len(names) for vector in vectors.values())
    assert "PAYEMS" in contestants.monthly_feature_names("cpi")
    assert "PAYEMS" not in contestants.monthly_feature_names("payrolls")
    assert contestants.monthly_feature_names("cpi")[:3] == ("LAG_1", "LAG_2", "LAG_3")


def test_monthly_features_ignore_indicator_values_published_after_made_on() -> None:
    observations = panel()
    targets, origins = tables(observations)
    cpi_origins = origins.filter(pl.col("target") == "cpi")
    row = cpi_origins.sort("period").row(20, named=True)
    before = contestants.monthly_features(observations, targets, cpi_origins, "cpi")[row["period"]]
    late = pl.DataFrame([
        ("INDPRO", add_months(row["period"], -1), 9999.0, row["made_on"] + timedelta(days=3), None),
        ("INDPRO", add_months(row["period"], -2), 9999.0, row["made_on"] + timedelta(days=3), None),
    ], schema=OBSERVATION_SCHEMA, orient="row")
    changed = pl.concat([observations, late])
    after = contestants.monthly_features(changed, targets, cpi_origins, "cpi")[row["period"]]
    np.testing.assert_array_equal(before, after)


def test_a_lagged_first_print_is_hidden_until_its_release_date() -> None:
    observations = panel()
    targets, origins = tables(observations)
    cpi_origins = origins.filter(pl.col("target") == "cpi")
    row = cpi_origins.sort("period").row(20, named=True)
    previous = add_months(row["period"], -1)
    visible = contestants.monthly_features(observations, targets, cpi_origins, "cpi")[row["period"]]
    earlier = targets.filter((pl.col("target") == "cpi") & (pl.col("period") == previous))
    first_print = earlier["first_print"][0]
    assert visible[0] == pytest.approx(first_print)
    delayed = targets.with_columns(
        pl.when((pl.col("target") == "cpi") & (pl.col("period") == previous))
        .then(pl.lit(row["made_on"] + timedelta(days=5)))
        .otherwise(pl.col("release_date")).alias("release_date"),
    )
    hidden = contestants.monthly_features(observations, delayed, cpi_origins, "cpi")[row["period"]]
    assert np.isnan(hidden[0])
    np.testing.assert_array_equal(visible[1:], hidden[1:])


@pytest.mark.parametrize("bad_base", [0.0, -5.0])
def test_a_growth_rate_needs_a_positive_base(bad_base: float) -> None:
    observations = panel()
    targets, origins = tables(observations)
    cpi_origins = origins.filter(pl.col("target") == "cpi")
    row = cpi_origins.sort("period").row(20, named=True)
    broken = observations.with_columns(
        pl.when(
            (pl.col("series_id") == "INDPRO")
            & pl.col("observation_date").is_in(
                [add_months(row["period"], -2), add_months(row["period"], -3)],
            ),
        ).then(pl.lit(bad_base)).otherwise(pl.col("value")).alias("value"),
    )
    vector = contestants.monthly_features(broken, targets, cpi_origins, "cpi")[row["period"]]
    position = contestants.monthly_feature_names("cpi").index("INDPRO")
    assert np.isnan(vector[position])


@pytest.fixture(scope="module")
def walk_forward() -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    observations = panel()
    targets, origins = tables(observations)
    result = run_walk_forward(observations, None, targets, origins)
    return observations, targets, origins, result.sort("target", "period", "contestant")


def test_walk_forward_gives_ridge_forecasts_for_cpi_and_payrolls(walk_forward) -> None:
    result = walk_forward[3]
    for target in ("cpi", "payrolls"):
        found = set(result.filter(pl.col("target") == target)["contestant"].to_list())
        assert {"naive", "ar", "ridge", "factor_ridge", "lasso"} <= found


def test_shuffled_origins_give_the_same_forecasts_as_sorted_origins(walk_forward) -> None:
    observations, targets, origins, ordered = walk_forward
    shuffled_origins = origins.sample(fraction=1.0, shuffle=True, seed=3)
    again = run_walk_forward(observations, None, targets, shuffled_origins)
    shuffled = again.sort("target", "period", "contestant")
    assert ordered.height == shuffled.height > 0
    assert ordered["period"].to_list() == shuffled["period"].to_list()
    np.testing.assert_allclose(
        ordered["value"].to_numpy(), shuffled["value"].to_numpy(), rtol=0, atol=1e-12,
    )
