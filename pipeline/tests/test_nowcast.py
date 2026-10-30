from datetime import date, timedelta

import numpy as np
import polars as pl
import pytest

from macro_event_lab.nowcast import (
    FEATURES,
    add_months,
    bootstrap_coefs,
    coefficient_table,
    gdp_previous,
    nowcast_rows,
    quarter_value,
    ridge_fit,
    vintage,
    walk_forward,
)

OBS_SCHEMA = {
    "series_id": pl.String, "observation_date": pl.Date, "value": pl.Float64,
    "realtime_start": pl.Date, "realtime_end": pl.Date,
}


def _obs(rows: list[tuple]) -> pl.DataFrame:
    return pl.DataFrame(rows, schema=OBS_SCHEMA, orient="row")


def test_add_months_crosses_years():
    assert add_months(date(2025, 11, 1), 3) == date(2026, 2, 1)
    assert add_months(date(2025, 2, 1), -3) == date(2024, 11, 1)


def test_quarter_growth_uses_the_months_already_published():
    d = date
    values = {d(2025, 4, 1): 100.0, d(2025, 5, 1): 100.0, d(2025, 6, 1): 100.0,
              d(2025, 7, 1): 101.0, d(2025, 8, 1): 101.0}  # September not out yet
    assert quarter_value(values, d(2025, 7, 1), "growth") == pytest.approx((1.01**4 - 1) * 100)
    assert quarter_value(values, d(2025, 7, 1), "change") == pytest.approx(1.0)
    assert quarter_value(values, d(2025, 10, 1), "growth") is None  # nothing for the quarter yet


def test_previous_gdp_growth_reads_the_two_quarters_before():
    d = date
    values = {d(2025, 1, 1): 100.0, d(2025, 4, 1): 101.0}
    assert gdp_previous(values, d(2025, 7, 1)) == pytest.approx((1.01**4 - 1) * 100)
    assert gdp_previous(values, d(2025, 4, 1)) is None


def test_vintage_ignores_revisions_published_after_the_date():
    d = date
    levels = _obs([
        ("PAYEMS", d(2025, 9, 1), 100.0, d(2025, 10, 3), d(2025, 11, 6)),
        ("PAYEMS", d(2025, 9, 1), 150.0, d(2025, 11, 7), None),
    ])
    assert vintage(levels, d(2025, 10, 29)) == {d(2025, 9, 1): 100.0}
    assert vintage(levels, d(2025, 11, 7)) == {d(2025, 9, 1): 150.0}


def test_rows_take_each_feature_from_the_day_before_the_advance_release():
    d = date
    gdp = [
        ("GDPC1", d(2025, 1, 1), 100.0, d(2025, 4, 30), None),
        ("GDPC1", d(2025, 4, 1), 101.0, d(2025, 7, 30), None),
        ("GDPC1", d(2025, 7, 1), 102.0, d(2025, 10, 30), None),
    ]
    payrolls = [("PAYEMS", d(2025, m, 1), 100.0, d(2025, m + 1, 5), None) for m in (4, 5, 6)]
    payrolls += [
        ("PAYEMS", d(2025, 7, 1), 101.0, d(2025, 8, 1), None),
        ("PAYEMS", d(2025, 8, 1), 101.0, d(2025, 9, 5), None),
        ("PAYEMS", d(2025, 9, 1), 101.0, d(2025, 10, 3), d(2025, 11, 6)),
        # a big revision a week after the advance release must not reach the Q3 row
        ("PAYEMS", d(2025, 9, 1), 500.0, d(2025, 11, 7), None),
    ]

    rows = nowcast_rows(_obs(gdp + payrolls), since=d(2025, 1, 1))
    q3 = rows.filter(pl.col("reference_period") == d(2025, 7, 1)).row(0, named=True)

    assert q3["as_of"] == d(2025, 10, 29)
    assert q3["PAYEMS"] == pytest.approx((1.01**4 - 1) * 100)
    assert q3["GDP_PREV"] == pytest.approx((1.01**4 - 1) * 100)
    assert q3["first_print"] == pytest.approx(round(((102 / 101) ** 4 - 1) * 100, 1))
    assert q3["INDPRO"] is None  # no data for this indicator in the test


def test_ridge_matches_least_squares_and_the_normal_equations():
    rng = np.random.default_rng(1)
    x = rng.normal(size=(40, 3))
    y = 2 + x @ np.array([1.0, -0.5, 0.25]) + rng.normal(scale=0.1, size=40)

    nearly_ols = ridge_fit(x, y, 1e-9)
    z = (x - x.mean(axis=0)) / x.std(axis=0)
    ols, *_ = np.linalg.lstsq(z, y - y.mean(), rcond=None)
    assert nearly_ols.coef == pytest.approx(ols, rel=1e-6)
    assert nearly_ols.predict(x) == pytest.approx(y.mean() + z @ ols, rel=1e-6)

    lam = 5.0
    normal = np.linalg.solve(z.T @ z + lam * np.eye(3), z.T @ (y - y.mean()))
    assert ridge_fit(x, y, lam).coef == pytest.approx(normal, rel=1e-9)
    assert np.abs(ridge_fit(x, y, 1e9).coef).max() < 1e-6


def _synthetic_rows(n: int = 30) -> pl.DataFrame:
    rng = np.random.default_rng(2)
    x = rng.normal(size=(n, len(FEATURES)))
    y = 2 + x[:, 0] + rng.normal(scale=0.2, size=n)
    quarters = [add_months(date(2010, 1, 1), 3 * i) for i in range(n)]
    released = [add_months(q, 4) for q in quarters]
    return pl.DataFrame({
        "reference_period": quarters,
        "release_date": released,
        "as_of": [r - timedelta(days=1) for r in released],
        "first_print": y,
        "previous_print": np.concatenate([[np.nan], y[:-1]]),
        **{f: x[:, i] for i, f in enumerate(FEATURES)},
    })


def test_walk_forward_never_trains_on_a_quarter_released_later():
    rows = _synthetic_rows()
    first = walk_forward(rows, min_train=10)
    assert first.height == 20
    assert (first["n_train"] < pl.Series(range(11, 31))).all()

    # changing the newest target must not move any earlier nowcast
    shocked = rows.with_columns(
        first_print=pl.when(pl.col("reference_period") == rows["reference_period"].max())
        .then(1e6).otherwise(pl.col("first_print"))
    )
    second = walk_forward(shocked, min_train=10)
    assert second["nowcast"].to_list() == pytest.approx(first["nowcast"].to_list())


def test_bootstrap_is_reproducible_and_covers_every_feature():
    rows = _synthetic_rows()
    x = rows.select(FEATURES).to_numpy()
    y = rows["first_print"].to_numpy()
    a = bootstrap_coefs(x, y, 1.0, draws=50, seed=3)
    b = bootstrap_coefs(x, y, 1.0, draws=50, seed=3)
    assert a.shape == (50, len(FEATURES))
    assert np.array_equal(a, b)


def test_coefficient_table_leaves_out_excluded_quarters():
    rows = _synthetic_rows()
    table = coefficient_table(rows, draws=50, exclude=(date(2010, 1, 1),))
    assert table["feature"].to_list() == FEATURES
    assert (table["lo"] <= table["hi"]).all()
    # the strong first feature drives y, so its interval sits above zero
    assert table.row(0, named=True)["lo"] > 0
