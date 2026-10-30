import numpy as np
import polars as pl
import pytest

pytest.importorskip("pymc")
import xarray as xr

from macro_event_lab import bayesian, cli, config
from macro_event_lab.bayesian import build_model, marginal_checks, posterior_tables, sample_model
from macro_event_lab.calibration import SERIES, calibration_design, fit_calibration, objective


@pytest.fixture
def rows():
    rng = np.random.default_rng(1)
    return pl.DataFrame({
        "series_ticker": list(SERIES) * 12,
        "event_ticker": [f"E{i}" for i in range(48)],
        "market_logit": rng.normal(size=48), "outcome": rng.binomial(1, 0.5, 48),
    })


@pytest.fixture
def trace():
    rng = np.random.default_rng(2)
    posterior = xr.Dataset({
        "shared": (("chain", "draw", "effect"), rng.normal(size=(4, 1000, 2))),
        "deviations": (("chain", "draw", "effect", "series"), rng.normal(size=(4, 1000, 2, 4))),
        "bias": (("chain", "draw", "series"), rng.normal(size=(4, 1000, 4))),
        "confidence": (("chain", "draw", "series"), 1 + rng.normal(size=(4, 1000, 4))),
        "scales": (("chain", "draw", "effect"), rng.exponential(size=(4, 1000, 2))),
    }, coords={"series": list(SERIES)})
    stats = xr.Dataset({"diverging": (("chain", "draw"), np.zeros((4, 1000), dtype=bool))})
    return xr.DataTree.from_dict({"posterior": posterior, "sample_stats": stats})


def test_fixed_scale_log_density_and_gradient_match_numpy_map(rows):
    model = build_model(rows, hierarchical=False)
    _, fit = fit_calibration(rows)
    point = {"shared": fit.coef[:2], "deviations": fit.coef[2:].reshape(2, 4)}
    gradient = model.compile_dlogp()(point)
    assert np.max(np.abs(gradient)) < 1e-7
    x, y, weights = calibration_design(rows)
    prior = np.zeros(10)
    prior[1] = 1
    other = {"shared": np.array([0.2, 0.8]), "deviations": np.full((2, 4), 0.1)}
    vector = np.concatenate([other["shared"], other["deviations"].ravel()])
    logp = model.compile_logp()
    assert logp(other) - logp(point) == pytest.approx(
        objective(fit.coef, x, y, weights, prior, np.ones(10))
        - objective(vector, x, y, weights, prior, np.ones(10))
    )


def test_generalized_likelihood_does_not_count_duplicate_contracts_twice(rows):
    first, second = build_model(rows), build_model(pl.concat([rows, rows]))
    point = first.initial_point()
    assert first.compile_logp()(point) == pytest.approx(second.compile_logp()(point))
    assert "scales_log__" in point


def test_sampling_smoke_has_distinct_chains_and_finite_effects(rows):
    trace = sample_model(build_model(rows), draws=50, tune=50, chains=2, seed=9)
    assert trace.posterior.sizes["chain"] == 2
    assert trace.posterior.sizes["draw"] == 50
    assert np.isfinite(trace.posterior["confidence"].values).all()


def test_sampling_rejects_invalid_settings(rows):
    with pytest.raises(ValueError):
        sample_model(build_model(rows), chains=1)


def test_posterior_summary_reports_conditional_probabilities_and_diagnostics(trace, rows):
    table, diagnostics = posterior_tables(trace, rows)
    assert table.height == 8
    assert (table["lo"] < table["median"]).all()
    assert (table["median"] < table["hi"]).all()
    assert table["prob_below_reference"].is_between(0, 1).all()
    assert (table["family_lo"] <= table["lo"]).all()
    assert (table["family_hi"] >= table["hi"]).all()
    assert diagnostics["r_hat"].is_finite().all()
    assert diagnostics["divergences"].max() == 0


def test_marginal_checks_use_equal_event_weights_and_seed(trace, rows):
    first = marginal_checks(trace, rows)
    assert first.equals(marginal_checks(trace, rows))
    assert first["observed_rate"].to_list() == pytest.approx(marginal_checks(
        trace, pl.concat([rows, rows])
    )["observed_rate"].to_list())
    assert first["observed_rate"].to_list() == pytest.approx(rows.group_by("series_ticker").agg(
        pl.col("outcome").mean()
    ).sort("series_ticker").join(
        pl.DataFrame({"series_ticker": list(SERIES), "order": range(4)}), on="series_ticker"
    ).sort("order")["outcome"].to_list())


def test_bayesian_command_writes_gated_local_outputs(tmp_path, monkeypatch, capsys, trace, rows):
    paths = config.Paths(tmp_path)
    paths.gold.mkdir()
    rows.write_parquet(paths.gold / "calibration_rows.parquet")
    monkeypatch.setattr(config, "get_paths", lambda: paths)
    monkeypatch.setattr(bayesian, "sample_model", lambda *args, **kwargs: trace)
    cli.main(["model", "--bayesian"])
    result = pl.read_parquet(paths.gold / "calibration_posterior.parquet")
    assert result["diagnostics_passed"].all()
    with np.load(paths.gold / "calibration_draws.npz") as saved:
        assert np.array_equal(saved["bias"], trace.posterior["bias"].values)
    assert "generalized posterior" in capsys.readouterr().out
    trace.sample_stats["diverging"].values[0, 0] = True
    with pytest.raises(RuntimeError, match="diagnostics failed"):
        bayesian.build_posterior(paths)
    assert not pl.read_parquet(paths.gold / "calibration_posterior.parquet")[
        "diagnostics_passed"
    ].any()
