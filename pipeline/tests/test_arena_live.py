from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta

import numpy as np
import polars as pl
import pytest

from macro_event_lab.arena import contestants, export
from macro_event_lab.arena.targets import (
    ORIGIN_SCHEMA,
    add_months,
    build_origins,
    first_print_targets,
)

OBSERVATION_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}
SERIES = ("CPIAUCSL", "PAYEMS", "INDPRO", "PCEC96", "RRSFS", "HOUST", "UNRATE")
AS_OF = date(2005, 8, 1)


def _levels(seed: int, count: int, base: float, drift: float) -> list[float]:
    rng = np.random.default_rng(seed)
    return list(base * np.cumprod(1 + rng.normal(drift, 0.004, count)))


def _monthly_series(series_id: str, values: list[float], start: date) -> pl.DataFrame:
    rows = []
    for i, value in enumerate(values):
        period = add_months(start, i)
        published = add_months(period, 1).replace(day=15)
        rows.append((series_id, period, value, published, None))
    return pl.DataFrame(rows, schema=OBSERVATION_SCHEMA, orient="row")


def _quarterly_gdp(quarters: int, start: date) -> tuple[pl.DataFrame, pl.DataFrame]:
    gdp_levels = _levels(99, quarters, 1000.0, 0.006)
    obs_rows = []
    survey_rows = []
    for i, value in enumerate(gdp_levels):
        period = add_months(start, 3 * i)
        published = add_months(period, 3).replace(day=28)
        obs_rows.append(("GDPC1", period, value, published, None))
        quarter = (period.month - 1) // 3 + 1
        survey_day = add_months(period, 1).replace(day=15)
        survey_rows.append({
            "survey_year": period.year,
            "survey_quarter": quarter,
            "variable": "gdp",
            "horizon": 0,
            "statistic": "median",
            "value": 2.0 + 0.05 * (i % 5),
            "known_from": datetime(
                survey_day.year, survey_day.month, survey_day.day, 14, 0, tzinfo=UTC,
            ),
            "known_from_source": "spf_news_release_date:end_of_day:America/New_York",
        })
    obs = pl.DataFrame(obs_rows, schema=OBSERVATION_SCHEMA, orient="row")
    return obs, pl.DataFrame(survey_rows)


def _panel(months: int, start: date = date(2000, 1, 1)) -> tuple[pl.DataFrame, pl.DataFrame]:
    monthly_frames = [
        _monthly_series(series, _levels(i, months, 100.0 + 50 * i, 0.002 + 0.0003 * i), start)
        for i, series in enumerate(SERIES)
    ]
    gdp_obs, survey = _quarterly_gdp(months // 3, start)
    return pl.concat([*monthly_frames, gdp_obs]), survey


@pytest.fixture(scope="module")
def full_arena() -> tuple[pl.DataFrame, pl.DataFrame, dict[str, object]]:
    observations, survey = _panel(66)
    return observations, survey, export.build_arena(observations, survey, AS_OF)


def test_live_includes_ridge_factor_ridge_and_lasso_for_every_target(
    full_arena: tuple[pl.DataFrame, pl.DataFrame, dict[str, object]],
) -> None:
    _observations, _survey, payload = full_arena
    by_target = {row["target"]: row for row in payload["live"]}
    assert set(by_target) == {"gdp", "cpi", "payrolls"}
    for target in ("gdp", "cpi", "payrolls"):
        values = by_target[target]["values"]
        for contestant in ("ridge", "factor_ridge", "lasso"):
            assert contestant in values
            assert math.isfinite(values[contestant])


def test_live_omits_penalized_contestants_when_training_rows_are_too_few(
    full_arena: tuple[pl.DataFrame, pl.DataFrame, dict[str, object]],
) -> None:
    short_obs, short_survey = _panel(15)
    short_payload = export.build_arena(short_obs, short_survey, date(2001, 6, 1))
    for row in short_payload["live"]:
        for contestant in ("ridge", "factor_ridge", "lasso"):
            assert contestant not in row["values"]

    observations, survey, _payload = full_arena
    targets = first_print_targets(observations)
    origins = build_origins(targets, survey)
    early_live = export._live(observations, targets, origins, survey, date(2001, 6, 1))
    for row in early_live:
        for contestant in ("ridge", "factor_ridge", "lasso"):
            assert contestant not in row["values"]


def test_live_ignores_vintages_published_after_information_date(
    full_arena: tuple[pl.DataFrame, pl.DataFrame, dict[str, object]],
) -> None:
    observations, survey, before = full_arena
    late_release = AS_OF + timedelta(days=10)
    later_rows = pl.DataFrame([
        ("INDPRO", date(2005, 5, 1), 99999.0, late_release, None),
        ("CPIAUCSL", date(2005, 5, 1), 99999.0, late_release, None),
        ("PAYEMS", date(2005, 5, 1), 99999.0, late_release, None),
        ("CPIAUCSL", date(2005, 6, 1), 500.0, late_release + timedelta(days=5), None),
        ("PAYEMS", date(2005, 6, 1), 5000.0, late_release + timedelta(days=5), None),
        ("GDPC1", date(2005, 7, 1), 5000.0, late_release + timedelta(days=15), None),
    ], schema=OBSERVATION_SCHEMA, orient="row")
    changed = pl.concat([observations, later_rows])
    targets = first_print_targets(changed)
    origins = build_origins(targets, survey)
    after_live = export._live(changed, targets, origins, survey, AS_OF)
    without_quantiles = [{k: v for k, v in r.items() if k != "quantiles"} for r in before["live"]]
    assert without_quantiles == after_live


def test_live_values_key_order_matches_contestants_order(
    full_arena: tuple[pl.DataFrame, pl.DataFrame, dict[str, object]],
) -> None:
    _observations, _survey, payload = full_arena
    contestant_order = [c["id"] for c in payload["contestants"]]
    for row in payload["live"]:
        keys = list(row["values"].keys())
        expected = [c for c in contestant_order if c in row["values"]]
        assert keys == expected


def test_live_matches_harness_code_path_on_information_date(
    full_arena: tuple[pl.DataFrame, pl.DataFrame, dict[str, object]],
) -> None:
    observations, survey, payload = full_arena
    assert payload["schema_version"] == 1

    targets = first_print_targets(observations)
    origins = build_origins(targets, survey)
    by_target = {row["target"]: row for row in payload["live"]}
    for target in ("gdp", "cpi", "payrolls"):
        live_row = by_target[target]
        period = date.fromisoformat(live_row["period"])
        frame = targets.filter(pl.col("target") == target)
        truth = {r["period"]: r for r in frame.iter_rows(named=True)}
        t_origins = origins.filter(pl.col("target") == target).sort("period")
        if target == "gdp":
            hist_features = contestants.gdp_features(observations, t_origins)
            live_origin = pl.DataFrame(
                [{"target": target, "period": period, "made_on": AS_OF}],
                schema=ORIGIN_SCHEMA, orient="row",
            )
            x_now = contestants.gdp_features(observations, live_origin)[period]
        else:
            hist_features = contestants.monthly_features(observations, targets, t_origins, target)
            live_origin = pl.DataFrame(
                [{"target": target, "period": period, "made_on": AS_OF}],
                schema=ORIGIN_SCHEMA, orient="row",
            )
            x_now = contestants.monthly_features(observations, targets, live_origin, target)[period]

        rows = [
            (r["period"], r["made_on"]) for r in t_origins.iter_rows(named=True)
            if r["period"] in truth and r["period"] in hist_features
        ]
        train_x = np.vstack([hist_features[p] for p, _ in rows])
        train_y = [truth[p]["first_print"] for p, _ in rows]
        train_release = [truth[p]["release_date"] for p, _ in rows]
        train_made_on = [m for _, m in rows]

        for name, fn in (
            ("ridge", contestants.ridge_forecast),
            ("factor_ridge", contestants.factor_ridge_forecast),
            ("lasso", contestants.lasso_forecast),
        ):
            expected = round(
                float(fn(train_x, train_y, train_release, train_made_on, x_now, AS_OF)), 4,
            )
            assert live_row["values"][name] == expected
