"""Whole-event temporal evaluation and paired event bootstrap for calibration."""

from __future__ import annotations

import numpy as np
import polars as pl

from macro_event_lab.calibration import calibration_design, fit_calibration


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


def walk_forward(rows: pl.DataFrame, min_events: int = 20) -> pl.DataFrame:
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
        _, fit = fit_calibration(train)
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


def score_predictions(predictions: pl.DataFrame, draws: int = 2000, seed: int = 0) -> pl.DataFrame:
    """Paired event bootstrap of mean score differences (calibrated minus raw market).

    First average contracts within each event and horizon. Clip probabilities only for log
    loss at 1e-12; Brier uses the original probabilities. Negative differences favour the model.
    """
    scores = predictions
    for name, column in (("market", "raw_prob"), ("model", "calibrated_prob")):
        p, y = pl.col(column).clip(1e-12, 1 - 1e-12), pl.col("outcome")
        scores = scores.with_columns(
            ((pl.col(column) - y) ** 2).alias(f"{name}_brier"),
            (-(y * p.log() + (1 - y) * (1 - p).log())).alias(f"{name}_log_loss"),
        )
    columns = [f"{name}_{metric}" for name in ("market", "model")
               for metric in ("brier", "log_loss")]
    per_event = scores.group_by("series_ticker", "hours_before_close", "event_ticker").agg(
        *[pl.col(c).mean() for c in columns]
    ).sort("series_ticker", "hours_before_close", "event_ticker")
    rng = np.random.default_rng(seed)
    out = []
    for (series, horizon), group in per_event.group_by(
        "series_ticker", "hours_before_close", maintain_order=True,
    ):
        for metric in ("brier", "log_loss"):
            market = group[f"market_{metric}"].to_numpy()
            model = group[f"model_{metric}"].to_numpy()
            delta = model - market
            boot = delta[rng.integers(len(delta), size=(draws, len(delta)))].mean(axis=1)
            lo, hi = np.quantile(boot, [0.025, 0.975])
            out.append((series, horizon, metric, len(delta), float(market.mean()),
                        float(model.mean()), float(delta.mean()), float(lo), float(hi)))
    return pl.DataFrame(out, schema={
        "series_ticker": pl.String, "hours_before_close": pl.Int64, "metric": pl.String,
        "n_events": pl.Int64, "market_score": pl.Float64, "model_score": pl.Float64,
        "delta": pl.Float64, "lo": pl.Float64, "hi": pl.Float64,
    }, orient="row").sort("series_ticker", "hours_before_close", "metric")
