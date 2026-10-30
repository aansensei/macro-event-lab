"""Hierarchical calibration under an explicitly event-weighted generalized posterior."""

from __future__ import annotations

import numpy as np
import polars as pl

from macro_event_lab.calibration import SERIES, calibration_design, sigmoid
from macro_event_lab.config import Paths


def build_model(rows: pl.DataFrame, hierarchical: bool = True):
    """Build the weighted likelihood with learned scales, or fixed scales matching MAP."""
    import pymc as pm

    x, y, weights = calibration_design(rows)
    with pm.Model(coords={"series": SERIES}) as model:
        shared = pm.Normal("shared", mu=[0.0, 1.0], sigma=1.0, shape=2)
        scales = pm.HalfNormal("scales", sigma=1.0, shape=2) if hierarchical else np.ones(2)
        deviations = pm.Normal("deviations", sigma=1.0, shape=(2, 4))
        bias = pm.Deterministic("bias", shared[0] + scales[0] * deviations[0], dims="series")
        confidence = pm.Deterministic(
            "confidence", shared[1] + scales[1] * deviations[1], dims="series",
        )
        indices = np.array([SERIES.index(s) for s in rows["series_ticker"]])
        eta = bias[indices] + confidence[indices] * x[:, 1]
        logp = pm.logp(pm.Bernoulli.dist(logit_p=eta), y)
        pm.Potential("weighted_likelihood", (weights * logp).sum())
    return model


def sample_model(model, draws: int = 1000, tune: int = 2000, chains: int = 4, seed: int = 0):
    """Sample sequential NUTS chains with fixed seed and retain convergence diagnostics."""
    import pymc as pm

    if draws < 4 or tune < 1 or chains < 2:
        raise ValueError("sampling requires at least two chains, four draws and positive tune")
    with model:
        return pm.sample(draws=draws, tune=tune, chains=chains, cores=1,
                         random_seed=seed, target_accept=0.99, progressbar=False)


def posterior_tables(trace, rows: pl.DataFrame) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Summarize marginal posterior intervals and diagnostics without significance labels."""
    import arviz as az

    diagnostics = az.summary(trace, var_names=["shared", "deviations", "bias", "confidence"]
                             + (["scales"] if "scales" in trace.posterior else []))
    divergences = int(trace.sample_stats["diverging"].sum())
    records = []
    for parameter in ("bias", "confidence"):
        samples = trace.posterior[parameter].transpose("chain", "draw", "series").values
        for i, series in enumerate(SERIES):
            values = samples[:, :, i].ravel()
            lo, median, hi = np.quantile(values, [0.025, 0.5, 0.975])
            family_lo, family_hi = np.quantile(values, [0.05 / 16, 1 - 0.05 / 16])
            n_events = rows.filter(pl.col("series_ticker") == series)["event_ticker"].n_unique()
            records.append((series, parameter, float(median), float(lo), float(hi),
                            float(family_lo), float(family_hi),
                            float(np.mean(values < (1 if parameter == "confidence" else 0))),
                            n_events))
    table = pl.DataFrame(records, schema={
        "series_ticker": pl.String, "parameter": pl.String, "median": pl.Float64,
        "lo": pl.Float64, "hi": pl.Float64, "family_lo": pl.Float64, "family_hi": pl.Float64,
        "prob_below_reference": pl.Float64,
        "n_events": pl.Int64,
    }, orient="row")
    diag = pl.from_pandas(diagnostics.reset_index().rename(columns={"index": "parameter"}))
    diag = diag.with_columns(divergences=pl.lit(divergences))
    return table, diag


def marginal_checks(trace, rows: pl.DataFrame, seed: int = 0) -> pl.DataFrame:
    """Simulate marginal Bernoulli rates, not coherent joint event outcomes or forecasts."""
    _, outcomes, weights = calibration_design(rows)
    bias = trace.posterior["bias"].transpose("chain", "draw", "series").values.reshape(-1, 4)
    confidence = trace.posterior["confidence"].transpose("chain", "draw", "series").values
    confidence = confidence.reshape(-1, 4)
    logits = rows["market_logit"].to_numpy()
    rng = np.random.default_rng(seed)
    records = []
    for i, series in enumerate(SERIES):
        mask = (rows["series_ticker"] == series).to_numpy()
        if not mask.any():
            continue
        w = weights[mask] / weights[mask].sum()
        prob = sigmoid(bias[:, i, None] + confidence[:, i, None] * logits[mask])
        replicated = rng.binomial(1, prob) @ w
        lo, median, hi = np.quantile(replicated, [0.025, 0.5, 0.975])
        records.append((series, float(outcomes[mask] @ w), float(median), float(lo), float(hi)))
    return pl.DataFrame(records, schema={
        "series_ticker": pl.String, "observed_rate": pl.Float64,
        "replicated_median": pl.Float64, "replicated_lo": pl.Float64, "replicated_hi": pl.Float64,
    }, orient="row")


def build_posterior(paths: Paths, draws: int = 1000, tune: int = 2000) -> dict[str, int]:
    """Write local generalized-posterior summaries, diagnostic gates and marginal checks."""
    rows = pl.read_parquet(paths.gold / "calibration_rows.parquet")
    trace = sample_model(build_model(rows), draws=draws, tune=tune)
    np.savez_compressed(paths.gold / "calibration_draws.npz", **{
        name: trace.posterior[name].values
        for name in ("shared", "scales", "deviations", "bias", "confidence")
    }, seed=np.array(0), draws=np.array(draws), tune=np.array(tune))
    posterior, diagnostics = posterior_tables(trace, rows)
    checks = marginal_checks(trace, rows)
    converged = bool(
        diagnostics["r_hat"].is_finite().all() and (diagnostics["r_hat"] <= 1.01).all()
        and (diagnostics["ess_bulk"] >= 400).all() and (diagnostics["ess_tail"] >= 400).all()
        and diagnostics["divergences"].max() == 0
    )
    tables = {"calibration_posterior": posterior.with_columns(diagnostics_passed=pl.lit(converged)),
              "calibration_diagnostics": diagnostics, "calibration_marginal_checks": checks}
    for name, frame in tables.items():
        frame.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    if not converged:
        raise RuntimeError("Posterior diagnostics failed; local outputs are marked unvalidated")
    return {name: frame.height for name, frame in tables.items()}
