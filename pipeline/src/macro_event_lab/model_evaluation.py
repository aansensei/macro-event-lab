"""Whole-event temporal evaluation and paired event bootstrap for calibration."""

from __future__ import annotations

import numpy as np
import polars as pl

from macro_event_lab.calibration import calibration_design, fit_calibration

PRIOR_SDS = (0.5, 1.0, 2.0)
# Four series, three horizons, two metrics, three method pairs and three fixed prior scales
COMPARISON_FAMILY = 4 * 3 * 2 * 3 * len(PRIOR_SDS)


def attach_label_times(rows: pl.DataFrame, markets: pl.DataFrame) -> pl.DataFrame:
    """Use settlement timestamps, or a conservative fetch-time upper bound when absent."""
    labels = markets.select(
        "ticker",
        label_known_from=pl.coalesce(
            "settlement_ts", pl.col("fetched_at_utc").str.to_datetime(time_zone="UTC"),
        ),
        label_time_source=pl.when(pl.col("settlement_ts").is_not_null())
        .then(pl.lit("settlement_ts")).otherwise(pl.lit("fetched_at_utc")),
    )
    return rows.join(labels, on="ticker", how="left", validate="m:1")


def walk_forward(rows: pl.DataFrame, min_events: int = 20, prior_sd: float = 1.0) -> pl.DataFrame:
    """Fit once before each event's earliest snapshot, with whole-event training groups.

    Every training label and snapshot must strictly precede that cutoff. Events with any
    missing label timestamp cannot train. All horizons share one fit, a conservative choice.
    """
    events = rows.group_by("event_ticker").agg(
        cutoff=pl.col("ts").min(), last_snapshot=pl.col("ts").max(),
        available=pl.col("label_known_from").max(),
        missing=pl.col("label_known_from").null_count(),
    ).sort("cutoff", "event_ticker")
    frames = []
    for event in events.iter_rows(named=True):
        cutoff = event["cutoff"]
        eligible = events.filter(
            (pl.col("event_ticker") != event["event_ticker"])
            & (pl.col("available") < cutoff) & (pl.col("last_snapshot") < cutoff)
            & (pl.col("missing") == 0)
        )
        if eligible.height < min_events:
            continue
        train = rows.filter(pl.col("event_ticker").is_in(eligible["event_ticker"].implode()))
        test = rows.filter(pl.col("event_ticker") == event["event_ticker"])
        _, fit = fit_calibration(train, prior_sd=prior_sd)
        design, _, _ = calibration_design(test)
        frames.append(test.with_columns(
            calibrated_prob=pl.Series(fit.predict(design)),
            fit_cutoff=pl.lit(cutoff), n_train_events=pl.lit(eligible.height),
            train_labels_through=pl.lit(eligible["available"].max()),
        ))
    if frames:
        return pl.concat(frames).sort("ts", "event_ticker", "ticker")
    return rows.head(0).with_columns(
        calibrated_prob=pl.lit(None, dtype=pl.Float64),
        fit_cutoff=pl.lit(None, dtype=rows.schema["ts"]),
        n_train_events=pl.lit(None, dtype=pl.Int32),
        train_labels_through=pl.lit(None, dtype=rows.schema["label_known_from"]),
    )


def score_predictions(
    predictions: pl.DataFrame, draws: int = 2000, seed: int = 0, family_size: int = 1,
) -> pl.DataFrame:
    """Pair raw, isotonic and MAP scores on identical held-out rows and bootstrap draws.

    First average contracts within each event and horizon. Clip probabilities only for log
    loss at 1e-12; Brier uses the original probabilities. Delta is candidate minus baseline.
    """
    if family_size < 1 or draws < 1:
        raise ValueError("family_size and draws must be positive")
    probabilities = {"raw": "raw_prob", "isotonic": "market_prob", "map": "calibrated_prob"}
    for column in (*probabilities.values(), "outcome"):
        values = predictions[column]
        if values.null_count() or not values.is_finite().all():
            raise ValueError("scoring requires finite probabilities and labels on common rows")
        if not values.is_between(0, 1).all():
            raise ValueError("scoring probabilities and labels must be in [0, 1]")
    if not predictions["outcome"].is_in([0, 1]).all():
        raise ValueError("scoring labels must be binary")
    scores = predictions
    for name, column in probabilities.items():
        p, y = pl.col(column).clip(1e-12, 1 - 1e-12), pl.col("outcome")
        scores = scores.with_columns(
            ((pl.col(column) - y) ** 2).alias(f"{name}_brier"),
            (-(y * p.log() + (1 - y) * (1 - p).log())).alias(f"{name}_log_loss"),
        )
    columns = [f"{name}_{metric}" for name in probabilities
               for metric in ("brier", "log_loss")]
    per_event = scores.group_by("series_ticker", "hours_before_close", "event_ticker").agg(
        *[pl.col(c).mean() for c in columns]
    ).sort("series_ticker", "hours_before_close", "event_ticker")
    rng = np.random.default_rng(seed)
    out = []
    for (series, horizon), group in per_event.group_by(
        "series_ticker", "hours_before_close", maintain_order=True,
    ):
        picks = rng.integers(len(group), size=(draws, len(group)))
        for metric in ("brier", "log_loss"):
            for baseline, candidate in (("raw", "isotonic"), ("isotonic", "map"), ("raw", "map")):
                before = group[f"{baseline}_{metric}"].to_numpy()
                after = group[f"{candidate}_{metric}"].to_numpy()
                delta = after - before
                boot = delta[picks].mean(axis=1)
                lo, hi = np.quantile(boot, [0.025, 0.975])
                tail = 0.05 / (2 * family_size)
                family_lo, family_hi = np.quantile(boot, [tail, 1 - tail])
                out.append((series, horizon, metric, baseline, candidate, len(delta),
                            float(before.mean()), float(after.mean()), float(delta.mean()),
                            float(lo), float(hi), float(family_lo), float(family_hi),
                            family_size, draws))
    return pl.DataFrame(out, schema={
        "series_ticker": pl.String, "hours_before_close": pl.Int64, "metric": pl.String,
        "baseline": pl.String, "candidate": pl.String,
        "n_events": pl.Int64, "baseline_score": pl.Float64, "candidate_score": pl.Float64,
        "delta": pl.Float64, "lo": pl.Float64, "hi": pl.Float64,
        "family_lo": pl.Float64, "family_hi": pl.Float64,
        "family_size": pl.Int64, "bootstrap_draws": pl.Int64,
    }, orient="row").sort("series_ticker", "hours_before_close", "metric", "baseline", "candidate")


def prior_sensitivity(
    rows: pl.DataFrame, reference_predictions: pl.DataFrame | None = None,
    min_events: int = 20, draws: int = 100000,
) -> pl.DataFrame:
    """Report every fixed prior scale on identical temporal splits without selecting a winner.

    Bonferroni intervals cover the full displayed comparison family, including prior scales.
    These bootstrap intervals remain approximate and depend on independent event sampling.
    """
    frames = []
    for sd in PRIOR_SDS:
        predictions = reference_predictions if sd == 1.0 else None
        if predictions is None:
            predictions = walk_forward(rows, min_events=min_events, prior_sd=sd)
        scores = score_predictions(predictions, draws=draws, family_size=COMPARISON_FAMILY)
        frames.append(scores.with_columns(prior_sd=pl.lit(sd)))
    return pl.concat(frames).sort(
        "prior_sd", "series_ticker", "hours_before_close", "metric", "baseline", "candidate",
    )
