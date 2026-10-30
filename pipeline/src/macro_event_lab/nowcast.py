"""GDP nowcast: predict the advance estimate from monthly data published before it.

For every quarter, each monthly indicator is read from the ALFRED vintage that was current the
day before the advance release, so the features hold only what a forecaster could know then.
A ridge regression (solved through the SVD) maps those features to the first print, and is
evaluated walk-forward: each quarter is predicted by a model fitted only on quarters released
before it, with the penalty chosen by an inner walk-forward on those same earlier quarters.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import polars as pl

from macro_event_lab.gold import first_prints

# Indicators and how each enters: annualised growth of the quarterly average, or the change
# in the quarterly average (the unemployment rate is already a percentage)
INDICATORS: dict[str, str] = {
    "PAYEMS": "growth",
    "INDPRO": "growth",
    "PCEC96": "growth",
    "RRSFS": "growth",
    "HOUST": "growth",
    "UNRATE": "change",
}
FEATURES = [*INDICATORS, "GDP_PREV"]
# Real retail sales vintages start in mid 2001, so the sample starts with 2002
NOWCAST_SINCE = date(2002, 1, 1)
# Quarters needed before the first out-of-sample prediction, and for choosing the penalty
MIN_TRAIN = 20
INNER = 8
LAMBDAS = (0.01, 0.1, 1.0, 3.0, 10.0, 30.0, 100.0, 300.0, 1000.0)
# The pandemic collapse and rebound (first prints near minus 33% and plus 33%) dwarf every other
# quarter, so the coefficient inference leaves them out; the walk-forward keeps them, as a
# forecaster at the time would have had them
COVID_QUARTERS = (date(2020, 4, 1), date(2020, 7, 1))


def add_months(d: date, months: int) -> date:
    m = d.month - 1 + months
    return date(d.year + m // 12, m % 12 + 1, 1)


def vintage(levels: pl.DataFrame, as_of: date) -> dict[date, float]:
    """observation_date -> value in the vintage current on `as_of` (null values left out)."""
    current = levels.filter(
        (pl.col("realtime_start") <= as_of)
        & (pl.col("realtime_end").is_null() | (pl.col("realtime_end") >= as_of))
        & pl.col("value").is_not_null()
    )
    return dict(zip(current["observation_date"].to_list(), current["value"].to_list(), strict=True))


def quarter_value(values: dict[date, float], quarter: date, kind: str) -> float | None:
    """The quarter's growth (annualised %) or change against the quarter before.

    Each quarter's average uses the months that have a value, so a third month not yet
    published, or a month never published (October 2025, in the shutdown), still gives a value.
    """
    now = [values[m] for m in (add_months(quarter, i) for i in range(3)) if m in values]
    before = [values[m] for m in (add_months(quarter, i - 3) for i in range(3)) if m in values]
    if not now or not before:
        return None
    avg_now = sum(now) / len(now)
    avg_before = sum(before) / len(before)
    if kind == "change":
        return avg_now - avg_before
    return ((avg_now / avg_before) ** 4 - 1) * 100


def gdp_previous(values: dict[date, float], quarter: date) -> float | None:
    """The previous quarter's annualised GDP growth, as that vintage had it."""
    last, before = values.get(add_months(quarter, -3)), values.get(add_months(quarter, -6))
    if last is None or before is None:
        return None
    return ((last / before) ** 4 - 1) * 100


def nowcast_rows(observations: pl.DataFrame, since: date = NOWCAST_SINCE) -> pl.DataFrame:
    """One row per GDP quarter: features as of the day before its advance release, and the target.

    `previous_print` is the previous quarter's first print, the naive guess.
    """
    targets = (
        first_prints(observations)
        .filter((pl.col("series_ticker") == "KXGDP") & pl.col("first_print").is_not_null())
        .sort("reference_period")
    )
    previous = {t["reference_period"]: t for t in targets.iter_rows(named=True)}
    targets = targets.filter(pl.col("reference_period") >= since)
    by_series = {
        s: observations.filter(pl.col("series_id") == s)
        for s in [*INDICATORS, "GDPC1"]
    }
    rows = []
    for t in targets.iter_rows(named=True):
        quarter, as_of = t["reference_period"], t["release_date"] - timedelta(days=1)
        prior = previous.get(add_months(quarter, -3))
        row = {
            "reference_period": quarter, "release_date": t["release_date"], "as_of": as_of,
            "first_print": t["first_print"],
            "previous_print": prior["first_print"]
            if prior is not None and prior["release_date"] <= as_of else None,
        }
        for series, kind in INDICATORS.items():
            row[series] = quarter_value(vintage(by_series[series], as_of), quarter, kind)
        row["GDP_PREV"] = gdp_previous(vintage(by_series["GDPC1"], as_of), quarter)
        rows.append(row)
    schema = {
        "reference_period": pl.Date, "release_date": pl.Date, "as_of": pl.Date,
        "first_print": pl.Float64, "previous_print": pl.Float64,
        **dict.fromkeys(FEATURES, pl.Float64),
    }
    return pl.DataFrame(rows, schema=schema, orient="row")


@dataclass(frozen=True)
class Ridge:
    intercept: float
    coef: np.ndarray  # per standardised feature
    mean: np.ndarray
    scale: np.ndarray

    def predict(self, x: np.ndarray) -> np.ndarray:
        return self.intercept + ((x - self.mean) / self.scale) @ self.coef


def ridge_fit(x: np.ndarray, y: np.ndarray, lam: float) -> Ridge:
    """Ridge regression on standardised features with an unpenalised intercept.

    With Z = U S V' (thin SVD), the solution is w = V diag(s / (s^2 + lam)) U' (y - mean y),
    which shrinks each singular direction by s^2 / (s^2 + lam) and never forms Z'Z.
    """
    mean = x.mean(axis=0)
    scale = x.std(axis=0)
    scale[scale == 0] = 1.0
    z = (x - mean) / scale
    u, s, vt = np.linalg.svd(z, full_matrices=False)
    coef = vt.T @ ((s / (s**2 + lam)) * (u.T @ (y - y.mean())))
    return Ridge(float(y.mean()), coef, mean, scale)


def choose_lambda(
    x: np.ndarray, y: np.ndarray, inner: int = INNER, *,
    release_dates: list[date] | None = None, as_of_dates: list[date] | None = None,
) -> float:
    """Choose a penalty using only labels available at each validation row's cutoff."""
    if (release_dates is None) != (as_of_dates is None):
        raise ValueError("release_dates and as_of_dates must be supplied together")
    start = max(2, len(y) - inner)
    splits = []
    for i in range(start, len(y)):
        train = [j for j in range(i) if release_dates is None or release_dates[j] <= as_of_dates[i]]
        if len(train) >= 2:
            splits.append((train, i))
    if not splits:
        return LAMBDAS[-1]
    best, best_err = LAMBDAS[0], float("inf")
    for lam in LAMBDAS:
        err = sum(
            float((ridge_fit(x[train], y[train], lam).predict(x[i : i + 1])[0] - y[i]) ** 2)
            for train, i in splits
        )
        if err < best_err:
            best, best_err = lam, err
    return best


def walk_forward(rows: pl.DataFrame, min_train: int = MIN_TRAIN) -> pl.DataFrame:
    """Out-of-sample nowcasts: each quarter is fitted only on quarters released by its as_of."""
    usable = rows.drop_nulls(FEATURES).sort("release_date")
    x = usable.select(FEATURES).to_numpy()
    y = usable["first_print"].to_numpy()
    released = usable["release_date"].to_list()
    cutoffs = usable["as_of"].to_list()
    out = []
    for i, as_of in enumerate(usable["as_of"].to_list()):
        train = [j for j, r in enumerate(released) if r <= as_of]
        if len(train) < min_train:
            continue
        lam = choose_lambda(
            x[train], y[train], release_dates=[released[j] for j in train],
            as_of_dates=[cutoffs[j] for j in train],
        )
        pred = ridge_fit(x[train], y[train], lam).predict(x[i : i + 1])[0]
        out.append((usable["reference_period"][i], float(pred), lam, len(train)))
    preds = pl.DataFrame(
        out, schema={"reference_period": pl.Date, "nowcast": pl.Float64, "lam": pl.Float64,
                     "n_train": pl.Int64}, orient="row",
    )
    return usable.join(preds, on="reference_period", how="inner")


def bootstrap_coefs(
    x: np.ndarray, y: np.ndarray, lam: float, draws: int = 1000, block: int = 4, seed: int = 0,
    quarters: list[date] | None = None,
) -> np.ndarray:
    """Ridge coefficients per original-sample SD, conditional on the selected penalty.

    Blocks have at most `block` rows and stop at missing quarters or the end of the sample.
    Penalty selection uncertainty and the choice of excluded quarters are not included.
    """
    rng = np.random.default_rng(seed)
    n = len(y)
    blocks = []
    for start in range(n):
        stop = start + 1
        while stop < min(start + block, n):
            if quarters is not None and quarters[stop] != add_months(quarters[stop - 1], 3):
                break
            stop += 1
        blocks.append(np.arange(start, stop))
    reference_scale = x.std(axis=0)
    out = np.empty((draws, x.shape[1]))
    for d in range(draws):
        picks = []
        size = 0
        while size < n:
            picked = blocks[rng.integers(len(blocks))]
            picks.append(picked)
            size += len(picked)
        idx = np.concatenate(picks)[:n]
        fit = ridge_fit(x[idx], y[idx], lam)
        out[d] = fit.coef / fit.scale * reference_scale
    return out


def error_summary(rows: pl.DataFrame, column: str) -> dict[str, float | int]:
    """Root mean squared and mean absolute error of `column` against the first print."""
    usable = rows.drop_nulls([column, "first_print"])
    err = (usable[column] - usable["first_print"]).to_numpy()
    if len(err) == 0:
        return {"n": 0, "rmse": float("nan"), "mae": float("nan")}
    rmse = float(np.sqrt((err**2).mean()))
    return {"n": len(err), "rmse": rmse, "mae": float(np.abs(err).mean())}


def market_comparison(
    predictions: pl.DataFrame, events: pl.DataFrame, stats: pl.DataFrame,
) -> pl.DataFrame:
    """Pair GDP predictions with the market's T-1h median on common quarters."""
    market = events.filter(pl.col("series_ticker") == "KXGDP").select(
        "event_ticker", "reference_period"
    ).join(
        stats.filter(pl.col("hours_before_close") == 1).select(
            "event_ticker", market_median="p50",
        ), on="event_ticker",
    ).drop_nulls("market_median")
    return predictions.join(market, on="reference_period")


def coefficient_table(
    rows: pl.DataFrame, draws: int = 1000, exclude: tuple[date, ...] = COVID_QUARTERS
) -> pl.DataFrame:
    """Full-sample standardised coefficients with 95% block bootstrap intervals.

    Each coefficient is the change in predicted GDP growth (percentage points) for a one SD
    move in that indicator, holding the others fixed. Quarters in `exclude` are left out.
    """
    usable = (
        rows.drop_nulls(FEATURES)
        .filter(~pl.col("reference_period").is_in(list(exclude)))
        .sort("release_date")
    )
    if usable.height < MIN_TRAIN:
        return pl.DataFrame(schema={"feature": pl.String, "coef": pl.Float64, "lo": pl.Float64,
                                    "hi": pl.Float64, "lam": pl.Float64})
    x = usable.select(FEATURES).to_numpy()
    y = usable["first_print"].to_numpy()
    lam = choose_lambda(
        x, y, release_dates=usable["release_date"].to_list(),
        as_of_dates=usable["as_of"].to_list(),
    )
    fit = ridge_fit(x, y, lam)
    boot = bootstrap_coefs(x, y, lam, draws, quarters=usable["reference_period"].to_list())
    return pl.DataFrame({
        "feature": FEATURES,
        "coef": fit.coef,
        "lo": np.percentile(boot, 2.5, axis=0),
        "hi": np.percentile(boot, 97.5, axis=0),
        "lam": [lam] * len(FEATURES),
    })
