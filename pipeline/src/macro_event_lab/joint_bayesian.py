"""One categorical observation per event, with coherent outcomes across strikes."""

from __future__ import annotations

import numpy as np
import polars as pl

from macro_event_lab.bayesian import posterior_tables, sample_model
from macro_event_lab.calibration import SERIES, sigmoid
from macro_event_lab.config import Paths

# Fixed contamination gives every category support, including bins flattened by isotonic fitting
SUPPORT_MIX = 0.01


def event_categories(rows: pl.DataFrame) -> list[dict]:
    """Select T-1h once per event and validate ordered probabilities and settlement labels."""
    events = []
    selected = rows.filter(pl.col("hours_before_close") == 1)
    for (event,), group in selected.group_by("event_ticker", maintain_order=True):
        group = group.sort("floor_strike")
        if group["series_ticker"].n_unique() != 1 or group["ts"].n_unique() != 1:
            raise ValueError(f"inconsistent event identity or snapshot: {event}")
        strikes = group["floor_strike"].to_numpy()
        prob = group["market_prob"].to_numpy()
        labels = group["outcome"].to_numpy()
        series = group["series_ticker"][0]
        if series not in SERIES or not np.isfinite(strikes).all() or (np.diff(strikes) <= 0).any():
            raise ValueError(f"invalid or duplicate strikes: {event}")
        if not np.isfinite(prob).all() or ((prob < 0) | (prob > 1)).any():
            raise ValueError(f"invalid probabilities: {event}")
        if (np.diff(prob) > 1e-12).any():
            raise ValueError(f"survival probabilities must decrease: {event}")
        if not np.isin(labels, [0, 1]).all() or (np.diff(labels.astype(float)) > 0).any():
            raise ValueError(f"settlement labels must decrease: {event}")
        clipped = np.clip(prob, 0.01, 0.99)
        events.append({"event_ticker": event, "series_ticker": series,
                       "index": SERIES.index(series), "strikes": strikes,
                       "logits": np.log(clipped / (1 - clipped)),
                       "category": int(labels.sum()), "ts": group["ts"][0]})
    if not events:
        raise ValueError("joint calibration requires T-1h events")
    return sorted(events, key=lambda e: (e["ts"], e["event_ticker"]))


def category_probabilities(
    logits: np.ndarray, bias: np.ndarray, confidence: np.ndarray,
) -> np.ndarray:
    """Transform ordered survival values into a supported categorical distribution."""
    if (np.asarray(confidence) <= 0).any():
        raise ValueError("confidence must be positive")
    survival = sigmoid(np.asarray(bias)[..., None] + np.asarray(confidence)[..., None] * logits)
    edges = np.concatenate([np.ones_like(survival[..., :1]), survival,
                            np.zeros_like(survival[..., :1])], axis=-1)
    bins = edges[..., :-1] - edges[..., 1:]
    if (bins < -1e-12).any():
        raise ValueError("survival probabilities must decrease")
    return (1 - SUPPORT_MIX) * bins + SUPPORT_MIX / bins.shape[-1]


def build_joint_model(events: list[dict]):
    """Fit one categorical outcome per event with positive hierarchical confidence."""
    import pymc as pm
    import pytensor.tensor as pt

    with pm.Model(coords={"series": SERIES}) as model:
        shared = pm.Normal("shared", mu=0, sigma=[1.0, 0.5], shape=2)
        scales = pm.HalfNormal("scales", sigma=[1.0, 0.5], shape=2)
        deviations = pm.Normal("deviations", sigma=1.0, shape=(2, 4))
        bias = pm.Deterministic("bias", shared[0] + scales[0] * deviations[0], dims="series")
        confidence = pm.Deterministic(
            "confidence", pt.exp(shared[1] + scales[1] * deviations[1]), dims="series",
        )
        # Ragged categories are padded with zero-probability entries, never additional outcomes
        width = max(len(e["logits"]) + 1 for e in events)
        lengths = np.array([len(e["logits"]) for e in events])
        indices = np.array([e["index"] for e in events])
        logits = np.zeros((len(events), width - 1))
        for i, event in enumerate(events):
            logits[i, :lengths[i]] = event["logits"]
        survival = pt.where(np.arange(width - 1)[None, :] < lengths[:, None],
                            pm.math.sigmoid(bias[indices, None]
                                            + confidence[indices, None] * logits), 0)
        edges = pt.concatenate([pt.ones((len(events), 1)), survival,
                                pt.zeros((len(events), 1))], axis=1)
        bins = edges[:, :-1] - edges[:, 1:]
        support = np.arange(width)[None, :] <= lengths[:, None]
        probabilities = (1 - SUPPORT_MIX) * bins + SUPPORT_MIX * support / (lengths[:, None] + 1)
        pm.Categorical("event_category", p=probabilities,
                       observed=np.array([e["category"] for e in events]))
    return model


def joint_checks(trace, events: list[dict], seed: int = 0) -> tuple[pl.DataFrame, pl.DataFrame]:
    """Draw one bin per event and derive every contract outcome from the shared draw."""
    bias = trace.posterior["bias"].transpose("chain", "draw", "series").values.reshape(-1, 4)
    confidence = trace.posterior["confidence"].transpose("chain", "draw", "series").values
    confidence = confidence.reshape(-1, 4)
    rng = np.random.default_rng(seed)
    draws, records = [], []
    for event in events:
        i = event["index"]
        prob = category_probabilities(event["logits"], bias[:, i], confidence[:, i])
        category = (rng.random(len(prob))[:, None] > prob.cumsum(axis=1)).sum(axis=1)
        # Count comparisons against every boundary except the last to prevent roundoff overflow
        category = np.minimum(category, len(event["logits"]))
        outcomes = (category[:, None] > np.arange(len(event["logits"]))[None, :]).astype(int)
        if (np.diff(outcomes, axis=1) > 0).any():
            raise RuntimeError("joint simulation produced inconsistent contract labels")
        observed = event["category"] / len(event["logits"])
        replicated = outcomes.mean(axis=1)
        lo, median, hi = np.quantile(replicated, [0.025, 0.5, 0.975])
        records.append((event["event_ticker"], event["series_ticker"], observed,
                        float(median), float(lo), float(hi), len(event["logits"])))
        draws.append(pl.DataFrame({"event_ticker": event["event_ticker"],
                                   "draw": np.arange(len(category)), "category": category}))
    return pl.DataFrame(records, schema={
        "event_ticker": pl.String, "series_ticker": pl.String, "observed_yes_fraction": pl.Float64,
        "replicated_median": pl.Float64, "replicated_lo": pl.Float64, "replicated_hi": pl.Float64,
        "n_contracts": pl.Int64,
    }, orient="row"), pl.concat(draws)


def build_joint_posterior(paths: Paths, draws: int = 1000, tune: int = 2000) -> dict[str, int]:
    """Write distinct local outputs for the T-1h event likelihood and predictive draws."""
    rows = pl.read_parquet(paths.gold / "calibration_rows.parquet")
    events = event_categories(rows)
    trace = sample_model(build_joint_model(events), draws=draws, tune=tune)
    summary, diagnostics = posterior_tables(trace, rows.filter(pl.col("hours_before_close") == 1))
    checks, replicated = joint_checks(trace, events)
    passed = bool(
        diagnostics["r_hat"].is_finite().all() and (diagnostics["r_hat"] <= 1.01).all()
        and (diagnostics["ess_bulk"] >= 400).all() and (diagnostics["ess_tail"] >= 400).all()
        and diagnostics["divergences"].max() == 0
    )
    tables = {"joint_calibration_posterior": summary.with_columns(
        diagnostics_passed=pl.lit(passed)),
              "joint_calibration_diagnostics": diagnostics, "joint_calibration_checks": checks,
              "joint_calibration_replicated": replicated}
    np.savez_compressed(paths.gold / "joint_calibration_draws.npz", **{
        name: trace.posterior[name].values
        for name in ("shared", "scales", "deviations", "bias", "confidence")
    }, seed=np.array(0), draws=np.array(draws), tune=np.array(tune),
        support_mix=np.array(SUPPORT_MIX))
    for name, frame in tables.items():
        frame.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    if not passed:
        raise RuntimeError("Joint posterior diagnostics failed; outputs are marked unvalidated")
    return {name: frame.height for name, frame in tables.items()}
