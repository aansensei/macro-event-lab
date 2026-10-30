"""Gold layer: tables derived from silver for analysis and the website.

contract_prices turns each hourly Kalshi candle into one usable YES price: the bid/ask mid
when the book is sane and tight, else the last trade, else nothing.

implied_distributions reads, for every event and every hour of the 7 days before it closes,
the latest usable price of each "above k" contract known at that hour. Those prices estimate
the survival function S(k) = P(X > k); isotonic regression weighted by inverse spread makes S
non-increasing in k, and differences of S give the probability of each outcome bin, which sum
to 1 by construction.

implied_stats summarises each snapshot's bins (mean, standard deviation, 5/25/50/75/95
percentiles), and implied_bins carries the T-168h probability of each bin for comparison.
"""

from __future__ import annotations

import calendar
import re
from datetime import date, datetime

import polars as pl

from macro_event_lab.config import RELEASE_TZ, Paths
from macro_event_lab.sources.releases import fomc_statement_dates

# In the 7 days before a market closes, 96 to 99.7% of candles have a spread of at most
# 10 cents (median 1 to 2 cents), so a wider book no longer says where the price is.
MAX_SPREAD = 0.10
# Kalshi quotes in 1 cent steps, so a locked book (bid equal to ask) counts as 1 cent wide
MIN_SPREAD = 0.01
WINDOW_HOURS = 168
SNAPSHOT_KEYS = ["series_ticker", "event_ticker", "ts", "hours_before_close"]
# Smallest step of the published number, measured on settled expiration values: CPI and GDP
# are published to 0.1 point, the Fed target upper bound moves in 0.25 point steps, and
# payrolls are published in thousands of jobs.
RESOLUTION = {"KXCPI": 0.1, "KXGDP": 0.1, "KXFED": 0.25, "KXPAYROLLS": 1000.0}
QUANTILES = (0.05, 0.25, 0.50, 0.75, 0.95)
# The ALFRED series behind each Kalshi series and the months between observations. The Fed
# target rate is not in ALFRED here, so FOMC events use Kalshi's settled value instead.
FIRST_PRINT_SERIES = {
    "KXCPI": ("CPIAUCSL", 1),
    "KXPAYROLLS": ("PAYEMS", 1),
    "KXGDP": ("GDPC1", 3),
}
# Fallback for events whose ticker names no period: the release is the series' first new
# observation within this many days after the markets close, shorter than one monthly cycle.
RELEASE_MATCH_DAYS = 14

# An FOMC event's decision is the first scheduled statement within this many days of the close.
# Early markets closed the evening a day or two before the decision, later ones minutes before it.
FOMC_MATCH_DAYS = 7
MONTHS = {m: i for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"], start=1
)}
# -25SEP, -21JUN30, -25OCT30, -23DECB (a second event for the same month)
TICKER_PERIOD = re.compile(r"-(\d{2})([A-Z]{3})(\d{2})?[A-Z]?$")
# the one legacy GDP ticker spelled with its quarter: GDP-232022 Q4
TICKER_QUARTER = re.compile(r"-\d{2}(\d{4}) Q([1-4])$")
PUBLISHED_VALUE = r"(?:^|[^0-9.])(-?[0-9]*\.?[0-9]+)%?\s*$"
BIN_TYPE = pl.Struct({"bin_lower": pl.Float64, "bin_upper": pl.Float64, "prob": pl.Float64})


def contract_prices(candles: pl.DataFrame) -> pl.DataFrame:
    """One price per (ticker, end_period_ts) with its source ("mid", "trade" or null) and weight.

    A crossed book (bid above ask, e.g. the stale bids listed in quality.KNOWN_ANOMALIES)
    never yields a mid; it falls back to the trade price like a too-wide book does.
    The weight is the inverse spread (a 1 cent book weighs 100, a 10 cent book 10); a trade
    price weighs at most as much as the widest acceptable book, so it never outranks a mid.
    """
    bid, ask = pl.col("yes_bid_close"), pl.col("yes_ask_close")
    # rounding keeps 0.55 - 0.45 (0.10000000000000003 in floating point) inside the limit
    spread = (ask - bid).round(6)
    usable_mid = (bid <= ask) & (spread <= MAX_SPREAD)
    has_trade = pl.col("price_close").is_not_null()
    return (
        candles.select("ticker", "end_period_ts", "yes_bid_close", "yes_ask_close", "price_close")
        .with_columns(spread=spread)
        .with_columns(
            price=pl.when(usable_mid).then((bid + ask) / 2)
            .when(has_trade).then(pl.col("price_close"))
            .otherwise(None),
            price_source=pl.when(usable_mid).then(pl.lit("mid"))
            .when(has_trade).then(pl.lit("trade"))
            .otherwise(pl.lit(None, dtype=pl.String)),
            weight=pl.when(usable_mid).then(1 / pl.max_horizontal(spread, MIN_SPREAD))
            .when(has_trade).then(1 / pl.max_horizontal(spread.abs(), MAX_SPREAD))
            .otherwise(None),
        )
        .sort("ticker", "end_period_ts")
    )


def isotonic_decreasing(values: list[float], weights: list[float] | None = None) -> list[float]:
    """Closest non-increasing sequence in weighted least squares (pool adjacent violators).

    Values are clipped to [0, 1] first, since they are probabilities. A pooled run takes the
    weighted mean of its values, so a low-weight outlier moves its neighbours very little.
    """
    weights = weights if weights is not None else [1.0] * len(values)
    blocks: list[list[float]] = []  # [weighted sum, total weight, length] of each pooled run
    for v, w in zip(values, weights, strict=True):
        blocks.append([min(1.0, max(0.0, v)) * w, w, 1])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] < blocks[-1][0] / blocks[-1][1]:
            total, weight, length = blocks.pop()
            blocks[-1][0] += total
            blocks[-1][1] += weight
            blocks[-1][2] += length
    return [total / weight for total, weight, length in blocks for _ in range(int(length))]


def bins_from_survival(
    strikes: list[float], survival: list[float]
) -> list[tuple[float | None, float | None, float]]:
    """(lower, upper, probability) for X <= k1, then k_i < X <= k_{i+1}, then X > k_n.

    `survival` must be non-increasing; None marks an open end.
    """
    s = [1.0, *survival, 0.0]
    edges = [None, *strikes, None]
    return [(edges[i], edges[i + 1], s[i] - s[i + 1]) for i in range(len(s) - 1)]


def bin_intervals(
    lowers: list[float | None], uppers: list[float | None], resolution: float
) -> list[tuple[float, float]]:
    """Real-valued interval each outcome bin covers, for spreading its probability uniformly.

    A bin (a, b] holds the published values a + r, ..., b, which are what real values in
    (a + r/2, b + r/2] round to; for CPI the bin (0.3, 0.4] therefore centres on 0.4, not 0.35.
    The open tails are assumed as wide as the median gap between the strikes.
    """
    strikes = [x for x in uppers if x is not None]
    gaps = sorted(b - a for a, b in zip(strikes, strikes[1:], strict=False) if b > a)
    tail = gaps[len(gaps) // 2] if gaps else resolution
    half = resolution / 2
    out = []
    for lo, hi in zip(lowers, uppers, strict=True):
        lo = hi - tail if lo is None else lo
        hi = lo + tail if hi is None else hi
        out.append((lo + half, hi + half))
    return out


def distribution_stats(
    lowers: list[float | None],
    uppers: list[float | None],
    probs: list[float],
    resolution: float,
) -> dict[str, float | None]:
    """Mean, standard deviation and QUANTILES of a binned distribution.

    Each bin's probability is spread uniformly over its interval from bin_intervals, so the
    quantiles interpolate within a bin. Needs at least two strikes (three bins); fewer give None.
    """
    names = ["mean", "sd", *(f"p{round(q * 100):02d}" for q in QUANTILES)]
    if len(probs) < 3:
        return dict.fromkeys(names)
    intervals = bin_intervals(lowers, uppers, resolution)
    mean = sum(p * (lo + hi) / 2 for p, (lo, hi) in zip(probs, intervals, strict=True))
    second = sum(
        p * ((hi - lo) ** 2 / 12 + ((lo + hi) / 2) ** 2)
        for p, (lo, hi) in zip(probs, intervals, strict=True)
    )
    stats: dict[str, float | None] = {"mean": mean, "sd": max(0.0, second - mean**2) ** 0.5}
    for q in QUANTILES:
        cum, value = 0.0, intervals[-1][1]
        for p, (lo, hi) in zip(probs, intervals, strict=True):
            if p > 0 and cum + p >= q:
                value = lo + (q - cum) / p * (hi - lo)
                break
            cum += p
        stats[f"p{round(q * 100):02d}"] = value
    return stats


def _cdf_knots(
    intervals: list[tuple[float, float]], probs: list[float]
) -> list[tuple[float, float]]:
    """(x, F(x)) at each edge of a piecewise-uniform distribution whose intervals touch."""
    knots = [(intervals[0][0], 0.0)]
    cum = 0.0
    for p, (_, hi) in zip(probs, intervals, strict=True):
        cum += p
        knots.append((hi, min(1.0, cum)))
    return knots


def _cdf_at(knots: list[tuple[float, float]], x: float) -> float:
    if x <= knots[0][0]:
        return 0.0
    for (x0, f0), (x1, f1) in zip(knots, knots[1:], strict=False):
        if x <= x1:
            return f0 if x1 == x0 else f0 + (f1 - f0) * (x - x0) / (x1 - x0)
    return knots[-1][1]


def pit_value(intervals: list[tuple[float, float]], probs: list[float], y: float) -> float:
    """Probability integral transform: the forecast CDF at the outcome, uniform when calibrated."""
    return _cdf_at(_cdf_knots(intervals, probs), y)


def crps_piecewise(intervals: list[tuple[float, float]], probs: list[float], y: float) -> float:
    """Exact continuous ranked probability score of a piecewise-uniform forecast at outcome y.

    CRPS is the integral of (F(x) minus the step at y) squared, in the outcome's own unit; lower
    is better. On each stretch between knots F is linear, so each piece integrates in closed form.
    """
    knots = _cdf_knots(intervals, probs)
    lo, hi = knots[0][0], knots[-1][0]
    xs = sorted({x for x, _ in knots} | ({y} if lo < y < hi else set()))
    total = 0.0
    for x0, x1 in zip(xs, xs[1:], strict=False):
        step = 1.0 if x0 >= y else 0.0
        f0, f1 = _cdf_at(knots, x0) - step, _cdf_at(knots, x1) - step
        total += (x1 - x0) * (f0 * f0 + f0 * f1 + f1 * f1) / 3
    if y < lo:
        total += lo - y
    if y > hi:
        total += y - hi
    return total


def brier_score(survival: list[tuple[float, float]], y: float) -> float | None:
    """Mean over strikes of (P(X > k) minus whether the outcome was above k) squared."""
    if not survival:
        return None
    return sum((p - (1.0 if y > k + 1e-9 else 0.0)) ** 2 for k, p in survival) / len(survival)


def forecast_scores(
    events: pl.DataFrame, bins: pl.DataFrame, survival: pl.DataFrame, stats: pl.DataFrame
) -> pl.DataFrame:
    """Per published event, how good the T-1h forecast was against its first print.

    brier, crps and pit score the whole distribution; abs_err_market is the distance from the
    T-1h median, abs_err_naive the distance from simply repeating the series' previous print.
    """
    scored = (
        events.filter(pl.col("first_print").is_not_null())
        .sort("series_ticker", "close")
        .with_columns(previous=pl.col("first_print").shift(1).over("series_ticker"))
    )
    at_t1h = pl.col("hours_before_close") == 1
    t1h_bins = bins.filter(at_t1h).partition_by("event_ticker", as_dict=True)
    t1h_surv = survival.filter(at_t1h).partition_by("event_ticker", as_dict=True)
    medians = dict(
        stats.filter(pl.col("hours_before_close") == 1).select("event_ticker", "p50").iter_rows()
    )
    rows = []
    for e in scored.iter_rows(named=True):
        key = (e["event_ticker"],)
        if key not in t1h_bins:
            continue
        y = e["first_print"]
        b = t1h_bins[key].sort("bin_lower", nulls_last=False)
        lowers, uppers, probs = (b[c].to_list() for c in ("bin_lower", "bin_upper", "prob"))
        resolution = RESOLUTION.get(e["series_ticker"], 0.1)
        enough = len(probs) >= 3
        intervals = bin_intervals(lowers, uppers, resolution) if enough else []
        s = t1h_surv.get(key)
        strikes = (
            [] if s is None else s.sort("floor_strike").select("floor_strike", "survival").rows()
        )
        median = medians.get(e["event_ticker"])
        rows.append({
            "event_ticker": e["event_ticker"],
            "brier": brier_score(strikes, y),
            "crps": crps_piecewise(intervals, probs, y) if enough else None,
            "pit": pit_value(intervals, probs, y) if enough else None,
            "abs_err_market": None if median is None else abs(median - y),
            "abs_err_naive": None if e["previous"] is None else abs(e["previous"] - y),
        })
    schema = {"event_ticker": pl.String, **dict.fromkeys(
        ("brier", "crps", "pit", "abs_err_market", "abs_err_naive"), pl.Float64
    )}
    return pl.DataFrame(rows, schema=schema)


def implied_stats(bins: pl.DataFrame) -> pl.DataFrame:
    """One row of distribution_stats per snapshot, using the series' RESOLUTION."""
    stat_type = pl.Struct({
        "mean": pl.Float64, "sd": pl.Float64,
        **{f"p{round(q * 100):02d}": pl.Float64 for q in QUANTILES},
    })
    return (
        bins.group_by(SNAPSHOT_KEYS, maintain_order=True)
        .agg("bin_lower", "bin_upper", "prob", n_bins=pl.len())
        .with_columns(
            stats=pl.struct("series_ticker", "bin_lower", "bin_upper", "prob").map_elements(
                lambda r: distribution_stats(
                    list(r["bin_lower"]), list(r["bin_upper"]), list(r["prob"]),
                    RESOLUTION.get(r["series_ticker"], 0.0),
                ),
                return_dtype=stat_type,
            )
        )
        .select([*SNAPSHOT_KEYS, "n_bins", "stats"])
        .unnest("stats")
    )


def with_week_ago(bins: pl.DataFrame) -> pl.DataFrame:
    """Add prob_t168: the same bin's probability in the event's T-168h snapshot.

    Null when the event has no T-168h snapshot or that snapshot had no such bin (a strike
    listed later in the week).
    """
    week_ago = bins.filter(pl.col("hours_before_close") == WINDOW_HOURS).select(
        "event_ticker", "bin_lower", "bin_upper", prob_t168="prob"
    )
    return bins.join(
        week_ago, on=["event_ticker", "bin_lower", "bin_upper"], how="left", nulls_equal=True
    )


def in_kalshi_units(series_ticker: str, value: float, previous: float) -> float:
    """The published number Kalshi settles on, from two consecutive ALFRED levels.

    CPI: month-over-month % change to 0.1; payrolls: jobs added (PAYEMS is in thousands),
    to the nearest thousand; GDP: quarter-over-quarter growth at an annual rate, % to 0.1.
    """
    if series_ticker == "KXCPI":
        return round((value / previous - 1) * 100, 1)
    if series_ticker == "KXPAYROLLS":
        return round((value - previous) * 1000, -3)
    if series_ticker == "KXGDP":
        return round(((value / previous) ** 4 - 1) * 100, 1)
    raise ValueError(f"no first-print rule for {series_ticker}")


def reference_period_from_event(series_ticker: str, event_ticker: str) -> date | None:
    """First day of the month (CPI, payrolls) or quarter (GDP) an event's number describes.

    CPI and payroll tickers name the month (KXCPI-25SEP). GDP tickers name a date: older ones
    the last day of the quarter itself (GDP-21JUN30 is Q2 2021), newer ones the release day,
    which falls in the following quarter (KXGDP-25OCT30 is Q3 2025). None when the ticker
    names no period.
    """
    if series_ticker == "KXGDP" and (q := TICKER_QUARTER.search(event_ticker)):
        return date(int(q.group(1)), 3 * int(q.group(2)) - 2, 1)
    m = TICKER_PERIOD.search(event_ticker)
    if not m or m.group(2) not in MONTHS:
        return None
    year, month = 2000 + int(m.group(1)), MONTHS[m.group(2)]
    if series_ticker in ("KXCPI", "KXPAYROLLS"):
        return date(year, month, 1)
    if series_ticker != "KXGDP" or m.group(3) is None:
        return None
    quarter_end = month % 3 == 0 and int(m.group(3)) == calendar.monthrange(year, month)[1]
    if not quarter_end:
        month -= 3  # a release day: the number describes the previous quarter
        if month < 1:
            month, year = month + 12, year - 1
    return date(year, 3 * ((month - 1) // 3) + 1, 1)


def first_prints(observations: pl.DataFrame) -> pl.DataFrame:
    """One row per (series_ticker, reference_period): its first release and first print.

    Both levels come from the vintage of the release day, so the change is the one actually
    announced, not one mixing a later revision of the previous period.
    """
    frames = []
    for series_ticker, (series_id, lag_months) in FIRST_PRINT_SERIES.items():
        obs = observations.filter(pl.col("series_id") == series_id)
        first = (
            obs.group_by("observation_date")
            .agg(release_date=pl.col("realtime_start").min())
            .join(obs, left_on=["observation_date", "release_date"],
                  right_on=["observation_date", "realtime_start"])
            .select("observation_date", "release_date", "value")
            .with_columns(
                previous_date=pl.col("observation_date").dt.offset_by(f"-{lag_months}mo")
            )
        )
        previous = obs.select(
            previous_date="observation_date", previous_value="value",
            prev_start="realtime_start", prev_end="realtime_end",
        )
        # the previous period's value as it stood on the release day
        in_vintage = (pl.col("prev_start") <= pl.col("release_date")) & (
            pl.col("prev_end").is_null() | (pl.col("prev_end") >= pl.col("release_date"))
        )
        paired = first.join(previous, on="previous_date", how="left").filter(
            pl.col("prev_start").is_null() | in_vintage
        )
        frames.append(
            paired.with_columns(
                series_ticker=pl.lit(series_ticker),
                first_print=pl.struct("value", "previous_value").map_elements(
                    lambda r, s=series_ticker: None
                    if r["value"] is None or r["previous_value"] is None
                    else in_kalshi_units(s, r["value"], r["previous_value"]),
                    return_dtype=pl.Float64,
                ),
            ).select(
                "series_ticker", "release_date", reference_period="observation_date",
                first_print="first_print",
            )
        )
    return pl.concat(frames).sort("series_ticker", "reference_period")


# Revisions are studied from this period on; older first vintages are not always the true release
REVISIONS_SINCE = date(2000, 1, 1)
REVISION_SCHEMA = {
    "series_ticker": pl.String, "reference_period": pl.Date, "release_date": pl.Date,
    "first_print": pl.Float64, "next_release_date": pl.Date, "next_print": pl.Float64,
    "latest_print": pl.Float64, "latest_vintage": pl.Date,
}
# Stands for "today": a vintage still current has no end date, so it covers any later day
CURRENT = date(9999, 12, 31)


def units_as_of(
    series_ticker: str, observations: pl.DataFrame, targets: pl.DataFrame
) -> pl.DataFrame:
    """(reference_period, as_of, value): each period in Kalshi units as of the vintage `as_of`.

    Both the period's level and the previous period's level come from that same vintage, the
    way first_prints pairs them on the release day. Periods missing from that vintage drop out.
    """
    series_id, lag_months = FIRST_PRINT_SERIES[series_ticker]
    levels = observations.filter(pl.col("series_id") == series_id).select(
        "observation_date", "value", "realtime_start", "realtime_end"
    )
    in_vintage = (pl.col("realtime_start") <= pl.col("as_of")) & (
        pl.col("realtime_end").is_null() | (pl.col("realtime_end") >= pl.col("as_of"))
    )

    def level_at(period_col: str, name: str) -> pl.DataFrame:
        return (
            targets.with_columns(
                previous=pl.col("reference_period").dt.offset_by(f"-{lag_months}mo")
            )
            .join(levels, left_on=period_col, right_on="observation_date")
            .filter(in_vintage)
            .select("reference_period", "as_of", pl.col("value").alias(name))
        )

    return (
        level_at("reference_period", "level")
        .join(level_at("previous", "previous_level"), on=["reference_period", "as_of"])
        .with_columns(
            value=pl.struct("level", "previous_level").map_elements(
                lambda r: None
                if r["level"] is None or r["previous_level"] is None
                else in_kalshi_units(series_ticker, r["level"], r["previous_level"]),
                return_dtype=pl.Float64,
            )
        )
        .select("reference_period", "as_of", "value")
    )


def revisions(observations: pl.DataFrame, since: date = REVISIONS_SINCE) -> pl.DataFrame:
    """One row per (series_ticker, reference_period) from `since`: how its number changed.

    first_print is the number on release day; next_print the same period in the series'
    next vintage (the next report, which for payrolls and GDP carries the first revision);
    latest_print the period in the current vintage. latest_vintage is the newest vintage date.
    """
    prints = first_prints(observations).filter(
        (pl.col("reference_period") >= since) & pl.col("first_print").is_not_null()
    )
    frames = []
    for series_ticker, (series_id, _) in FIRST_PRINT_SERIES.items():
        firsts = prints.filter(pl.col("series_ticker") == series_ticker).sort("release_date")
        if firsts.height == 0:
            continue
        vintages = (
            observations.filter(pl.col("series_id") == series_id)
            .select(next_release_date="realtime_start").unique().sort("next_release_date")
        )
        rows = firsts.with_columns(after=pl.col("release_date").dt.offset_by("1d")).join_asof(
            vintages, left_on="after", right_on="next_release_date", strategy="forward"
        )
        nexts = units_as_of(
            series_ticker, observations,
            rows.filter(pl.col("next_release_date").is_not_null())
            .select("reference_period", as_of="next_release_date"),
        ).select("reference_period", next_print="value")
        latest = units_as_of(
            series_ticker, observations,
            rows.select("reference_period", as_of=pl.lit(CURRENT)),
        ).select("reference_period", latest_print="value")
        frames.append(
            rows.join(nexts, on="reference_period", how="left")
            .join(latest, on="reference_period", how="left")
            .with_columns(latest_vintage=vintages["next_release_date"].max())
            .select(
                "series_ticker", "reference_period", "release_date", "first_print",
                "next_release_date", "next_print", "latest_print", "latest_vintage",
            )
        )
    if not frames:
        return pl.DataFrame(schema=REVISION_SCHEMA)
    return pl.concat(frames).sort("series_ticker", "reference_period")


def latest_per_release(prints: pl.DataFrame) -> pl.DataFrame:
    """One row per (series_ticker, release_date): the latest period first published that day.

    A release that first publishes several periods (a skipped month) is about the latest one.
    """
    return (
        prints.sort("series_ticker", "release_date", "reference_period")
        .group_by("series_ticker", "release_date", maintain_order=True)
        .last()
    )


def settled_from_results(markets: pl.DataFrame) -> pl.DataFrame:
    """Per event: the outcome implied by which "above k" contracts resolved yes and which no.

    The highest yes strike and the lowest no strike bracket the outcome in (yes, no]. When they
    are exactly one resolution step apart the outcome is the no strike; a wider gap, or a ladder
    that resolved all yes or all no, leaves it unknown. This reads events whose expiration_value
    Kalshi stored as text, such as "Above 3.50%" or "Yes".
    """
    resolved = pl.col("result").is_in(["yes", "no"])
    step = pl.col("series_ticker").replace_strict(RESOLUTION, default=None, return_dtype=pl.Float64)
    return (
        markets.filter(
            (pl.col("strike_type") == "greater") & pl.col("floor_strike").is_not_null() & resolved
        )
        .group_by("series_ticker", "event_ticker")
        .agg(
            yes_strike=pl.col("floor_strike").filter(pl.col("result") == "yes").max(),
            no_strike=pl.col("floor_strike").filter(pl.col("result") == "no").min(),
        )
        .with_columns(
            from_results=pl.when(
                ((pl.col("no_strike") - pl.col("yes_strike")) - step).abs() < 1e-9 * step
            )
            .then(pl.col("no_strike"))
            .otherwise(None)
        )
        .select("event_ticker", "from_results")
    )


def event_surprises(
    markets: pl.DataFrame,
    observations: pl.DataFrame,
    stats: pl.DataFrame,
    fomc_dates: list[date] | None = None,
) -> pl.DataFrame:
    """Per event: the first print, Kalshi's settled value, the T-1h mean and SD, and the surprise.

    surprise = first print minus the T-1h mean, in the published unit; surprise_sd divides it
    by the T-1h standard deviation. CPI, payrolls and GDP take the first print from ALFRED,
    matched on the period the ticker names (match_method "reference_period"), so a release a
    shutdown pushed back weeks still finds its event; a ticker that names no period falls back
    to the first release within RELEASE_MATCH_DAYS of the close ("release_window"). FOMC
    events, with no ALFRED series here, take Kalshi's settled value: the numeric
    expiration_value, or the value the strike results imply when Kalshi stored it as text,
    and their release_date is the statement date from `fomc_dates` matched to the close.
    """
    events = (
        markets.with_columns(
            # descriptive values such as "Above 3.50%" are not read as numbers
            settled=pl.when(pl.col("expiration_value").str.contains(r"^[0-9.,%+ -]+$"))
            .then(
                pl.col("expiration_value").str.replace_all(",", "")
                .str.extract(PUBLISHED_VALUE, 1).cast(pl.Float64, strict=False)
            )
            .otherwise(None)
        )
        .group_by("series_ticker", "event_ticker")
        .agg(
            close=pl.col("close_time").mode().max(),
            settled_value=pl.col("settled").drop_nulls().mode().max(),
        )
        .join(settled_from_results(markets), on="event_ticker", how="left")
        .with_columns(settled_value=pl.coalesce("settled_value", "from_results"))
        .drop("from_results")
        .with_columns(
            close_date=pl.col("close").dt.convert_time_zone(RELEASE_TZ).dt.date(),
            reference_period=pl.struct("series_ticker", "event_ticker").map_elements(
                lambda r: reference_period_from_event(r["series_ticker"], r["event_ticker"]),
                return_dtype=pl.Date,
            ),
        )
        .sort("close_date")
    )
    prints = first_prints(observations)
    by_period = events.join(prints, on=["series_ticker", "reference_period"], how="left")
    by_window = (
        events.drop("reference_period")
        .join_asof(
            latest_per_release(prints).sort("release_date"), left_on="close_date",
            right_on="release_date", by="series_ticker", strategy="forward",
            tolerance=f"{RELEASE_MATCH_DAYS}d", check_sortedness=False,
        )
        .select("event_ticker", w_release="release_date", w_period="reference_period",
                w_print="first_print")
    )
    use_window = pl.col("reference_period").is_null()
    matched = (
        by_period.join(by_window, on="event_ticker", how="left")
        .with_columns(
            match_method=pl.when(~pl.col("series_ticker").is_in(list(FIRST_PRINT_SERIES)))
            .then(None)
            .when(use_window).then(pl.lit("release_window"))
            .otherwise(pl.lit("reference_period")),
            release_date=pl.when(use_window).then("w_release").otherwise("release_date"),
            first_print=pl.when(use_window).then("w_print").otherwise("first_print"),
            reference_period=pl.when(use_window).then("w_period")
            .otherwise("reference_period"),
        )
        .sort("close_date")
        .join_asof(
            pl.DataFrame(
                {"statement_date": sorted(fomc_dates or [])}, schema={"statement_date": pl.Date}
            ),
            left_on="close_date", right_on="statement_date", strategy="forward",
            tolerance=f"{FOMC_MATCH_DAYS}d", check_sortedness=False,
        )
        .with_columns(
            release_date=pl.when(~pl.col("series_ticker").is_in(list(FIRST_PRINT_SERIES)))
            .then("statement_date").otherwise("release_date")
        )
    )
    at_t1h = stats.filter(pl.col("hours_before_close") == 1).select(
        "event_ticker", mean_t1h="mean", sd_t1h="sd"
    )
    return (
        matched.join(at_t1h, on="event_ticker", how="left")
        .with_columns(
            first_print_source=pl.when(pl.col("series_ticker").is_in(list(FIRST_PRINT_SERIES)))
            .then(pl.lit("alfred")).otherwise(pl.lit("kalshi")),
        )
        .with_columns(
            first_print=pl.when(pl.col("first_print_source") == "alfred")
            .then(pl.col("first_print")).otherwise(pl.col("settled_value")),
        )
        .with_columns(surprise=pl.col("first_print") - pl.col("mean_t1h"))
        .with_columns(
            surprise_sd=pl.when(pl.col("sd_t1h") > 0)
            .then(pl.col("surprise") / pl.col("sd_t1h")).otherwise(None)
        )
        .select(
            "series_ticker", "event_ticker", "close", "release_date", "reference_period",
            "match_method", "first_print", "first_print_source", "settled_value",
            "mean_t1h", "sd_t1h", "surprise", "surprise_sd",
        )
        .sort("series_ticker", "close")
    )


def snapshot_grid(markets: pl.DataFrame, data_end: datetime) -> pl.DataFrame:
    """One row per (event, hour) for the WINDOW_HOURS before the event closes.

    The event's close is the most common close time of its markets, truncated to the hour.
    Hours after `data_end` are dropped, so events that have not reached their window yet get
    no snapshots instead of snapshots built from old prices.
    """
    events = (
        markets.group_by("series_ticker", "event_ticker")
        .agg(close=pl.col("close_time").mode().max())
        .with_columns(
            anchor=pl.col("close").dt.truncate("1h"),
            hours_before_close=pl.lit(list(range(WINDOW_HOURS, -1, -1))),
        )
        .explode("hours_before_close")
    )
    return (
        events.with_columns(ts=pl.col("anchor") - pl.duration(hours=pl.col("hours_before_close")))
        .filter(pl.col("ts") <= data_end)
        .select(SNAPSHOT_KEYS)
    )


def implied_distributions(
    markets: pl.DataFrame, prices: pl.DataFrame
) -> tuple[pl.DataFrame, pl.DataFrame]:
    """(survival, bins) tables for every event snapshot.

    survival: one row per contract in a snapshot with its raw price, the age of that price and
    the isotonic S(k). bins: one row per outcome bin with its probability.
    """
    above = markets.filter(
        (pl.col("strike_type") == "greater") & pl.col("floor_strike").is_not_null()
    )
    valid = prices.filter(pl.col("price").is_not_null()).select(
        "ticker", "end_period_ts", "price", "weight"
    )
    grid = snapshot_grid(above, valid["end_period_ts"].max())

    # each contract takes its latest usable price at or before the snapshot hour
    members = (
        grid.join(above.select("event_ticker", "ticker", "floor_strike"), on="event_ticker")
        .sort("ts")
        .join_asof(
            valid.sort("end_period_ts"), left_on="ts", right_on="end_period_ts",
            by="ticker", strategy="backward", check_sortedness=False,
        )
        .filter(pl.col("price").is_not_null())
        .with_columns(
            price_age_h=(pl.col("ts") - pl.col("end_period_ts")).dt.total_hours()
        )
        .sort([*SNAPSHOT_KEYS, "floor_strike", "ticker"])
    )

    fitted = (
        members.group_by(SNAPSHOT_KEYS, maintain_order=True)
        .agg("ticker", "floor_strike", "price", "weight", "price_age_h")
        .with_columns(
            survival=pl.struct("price", "weight").map_elements(
                lambda r: isotonic_decreasing(list(r["price"]), list(r["weight"])),
                return_dtype=pl.List(pl.Float64),
            )
        )
    )
    survival = fitted.explode(
        ["ticker", "floor_strike", "price", "weight", "price_age_h", "survival"]
    )
    bins = (
        fitted.with_columns(
            bins=pl.struct("floor_strike", "survival").map_elements(
                lambda r: [
                    {"bin_lower": lo, "bin_upper": hi, "prob": p}
                    for lo, hi, p in bins_from_survival(r["floor_strike"], r["survival"])
                ],
                return_dtype=pl.List(BIN_TYPE),
            )
        )
        .select([*SNAPSHOT_KEYS, "bins"])
        .explode("bins")
        .unnest("bins")
    )
    return survival, bins


REACTION_SERIES = {"DGS2": "dgs2_change_bp", "DGS10": "dgs10_change_bp"}
MARKET_PORTFOLIO = "Market"


def reaction_days(events: pl.DataFrame) -> pl.DataFrame:
    """(event_ticker, reaction_date): the day markets reacted to each published event.

    CPI, jobs and GDP react on their release date (08:30 ET, before the market opens); FOMC
    events on their statement date, or the New York date of the close when no meeting matched
    one. Events never published
    have no reaction day, even when ALFRED lists their empty month on a later release's date.
    """
    return (
        events.with_columns(
            reaction_date=pl.when(pl.col("first_print_source") == "kalshi")
            .then(pl.coalesce(
                "release_date", pl.col("close").dt.convert_time_zone(RELEASE_TZ).dt.date()
            ))
            .when(pl.col("first_print").is_not_null())
            .then(pl.col("release_date"))
            .otherwise(None)
        )
        .filter(pl.col("reaction_date").is_not_null())
        .select("event_ticker", "reaction_date")
    )


def release_industry_returns(events: pl.DataFrame, french_daily: pl.DataFrame) -> pl.DataFrame:
    """Long rows (event_ticker, reaction_date, portfolio, ret_pct) for each reaction day.

    Portfolios are the value-weighted industries of the industries file plus "Market", the
    market excess return plus the T-bill rate (Mkt-RF + RF), all in percent for that one day.
    A reaction day the library does not cover yet (it lags a month or two) has no rows.
    """
    industries = french_daily.filter(pl.col("file") == "industries_12").select(
        "portfolio", "date", "ret_pct"
    )
    factors = french_daily.filter(pl.col("file") == "factors")
    market = (
        factors.filter(pl.col("portfolio").is_in(["Mkt-RF", "RF"]))
        .group_by("date")
        .agg(ret_pct=pl.col("ret_pct").sum(), parts=pl.col("ret_pct").count())
        .filter(pl.col("parts") == 2)
        .select(pl.lit(MARKET_PORTFOLIO).alias("portfolio"), "date", "ret_pct")
    )
    returns = pl.concat([industries, market])
    return (
        reaction_days(events)
        .join(returns, left_on="reaction_date", right_on="date", how="inner")
        .select("event_ticker", "reaction_date", "portfolio", "ret_pct")
        .sort("event_ticker", "portfolio")
    )


def release_reactions(events: pl.DataFrame, observations: pl.DataFrame) -> pl.DataFrame:
    """Per event: the change in the 2 and 10 year yields on its reaction day, in bp.

    The reaction day comes from `reaction_days`. The change is that day's close minus the last
    close before it, so a holiday before the release is skipped; a release on a market holiday
    has no change.
    """
    base = (
        reaction_days(events)
        .with_columns(day_before=pl.col("reaction_date") - pl.duration(days=1))
        .sort("day_before")
    )
    out = base.select("event_ticker", "reaction_date")
    for series_id, column in REACTION_SERIES.items():
        closes = (
            observations.filter(
                (pl.col("series_id") == series_id)
                & pl.col("realtime_end").is_null()
                & pl.col("value").is_not_null()
            )
            .select("observation_date", "value")
            .sort("observation_date")
        )
        on_day = base.join(
            closes, left_on="reaction_date", right_on="observation_date", how="left"
        ).select("event_ticker", on_day="value")
        before = base.join_asof(
            closes.rename({"observation_date": "prev_date", "value": "prev_value"}),
            left_on="day_before", right_on="prev_date", strategy="backward",
        ).select("event_ticker", "prev_date", "prev_value")
        change = on_day.join(before, on="event_ticker").select(
            "event_ticker",
            pl.col("prev_date").alias(f"{series_id}_prev_date"),
            ((pl.col("on_day") - pl.col("prev_value")) * 100).round(1).alias(column),
        )
        out = out.join(change, on="event_ticker", how="left")
    return out.select(
        "event_ticker",
        "reaction_date",
        pl.col("DGS10_prev_date").alias("reaction_prev_date"),
        *REACTION_SERIES.values(),
    )


MIN_YIELD_PAIRS = 10


def event_insights(
    events: pl.DataFrame, stats: pl.DataFrame, min_pairs: int = MIN_YIELD_PAIRS
) -> pl.DataFrame:
    """What each event says once set against every other event of its series.

    Per event: whether the first print fell inside the T-1h 50% and 90% ranges, and
    surprise_rank_pct, the share of the series' other published events with a smaller absolute
    surprise (in SD). Per series, attached to each of its events: series_n published events,
    series_hit_50 and series_hit_90, the share of first prints inside those ranges (a calibrated
    market lands near 0.5 and 0.9), and the least squares slope of the release-day 2 and 10 year
    yield changes on the surprise, in bp per SD, with their correlations. A series with fewer than
    `min_pairs` events that have both a surprise and yield changes gets no slope.
    """
    t1h = stats.filter(pl.col("hours_before_close") == 1).select(
        "event_ticker", "p05", "p25", "p75", "p95"
    )
    fp = pl.col("first_print")
    abs_sd = pl.col("surprise_sd").abs()
    known = abs_sd.count().over("series_ticker")
    ranked = events.join(t1h, on="event_ticker", how="left").with_columns(
        in_50=pl.when(fp.is_null() | pl.col("p25").is_null()).then(None)
        .otherwise(fp.is_between(pl.col("p25"), pl.col("p75"))),
        in_90=pl.when(fp.is_null() | pl.col("p05").is_null()).then(None)
        .otherwise(fp.is_between(pl.col("p05"), pl.col("p95"))),
        surprise_rank_pct=pl.when(abs_sd.is_null() | (known < 2)).then(None)
        .otherwise((abs_sd.rank("min").over("series_ticker") - 1) / (known - 1)),
    )
    series = ranked.group_by("series_ticker").agg(
        series_n=pl.col("surprise_sd").count(),
        series_hit_50=pl.col("in_50").cast(pl.Float64).mean(),
        series_hit_90=pl.col("in_90").cast(pl.Float64).mean(),
    )
    sd = pl.col("surprise_sd")
    sensitivity = (
        ranked.filter(
            sd.is_not_null()
            & pl.col("dgs2_change_bp").is_not_null()
            & pl.col("dgs10_change_bp").is_not_null()
        )
        .group_by("series_ticker")
        .agg(
            yield_n=pl.len(),
            dgs2_bp_per_sd=pl.cov(sd, "dgs2_change_bp") / sd.var(),
            dgs10_bp_per_sd=pl.cov(sd, "dgs10_change_bp") / sd.var(),
            dgs2_corr=pl.corr(sd, "dgs2_change_bp"),
            dgs10_corr=pl.corr(sd, "dgs10_change_bp"),
        )
        .with_columns(
            pl.when(pl.col("yield_n") >= min_pairs).then(pl.col(c)).otherwise(None).alias(c)
            for c in ("dgs2_bp_per_sd", "dgs10_bp_per_sd", "dgs2_corr", "dgs10_corr")
        )
    )
    return (
        ranked.select("event_ticker", "series_ticker", "in_50", "in_90", "surprise_rank_pct")
        .join(series, on="series_ticker", how="left")
        .join(sensitivity, on="series_ticker", how="left")
        .drop("series_ticker")
    )


def build_gold(paths: Paths) -> dict[str, int]:
    candles = pl.read_parquet(paths.silver / "kalshi_candles.parquet")
    markets = pl.read_parquet(paths.silver / "kalshi_markets.parquet")
    paths.gold.mkdir(parents=True, exist_ok=True)
    observations = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    prices = contract_prices(candles)
    survival, bins = implied_distributions(markets, prices)
    stats = implied_stats(bins)
    surprises = event_surprises(markets, observations, stats, fomc_statement_dates())
    events = surprises.join(
        release_reactions(surprises, observations), on="event_ticker", how="left"
    )
    # nowcast builds on first_prints from this module, so it is imported here to avoid a cycle
    from macro_event_lab import nowcast

    gdp_rows = nowcast.nowcast_rows(observations)
    tables = {
        "contract_prices": prices,
        "implied_survival": survival,
        "implied_bins": with_week_ago(bins),
        "implied_stats": stats,
        "revisions": revisions(observations),
        "gdp_nowcast": nowcast.walk_forward(gdp_rows),
        "gdp_nowcast_coefs": nowcast.coefficient_table(gdp_rows),
        "event_surprise": events.join(event_insights(events, stats), on="event_ticker", how="left")
        .join(forecast_scores(events, bins, survival, stats), on="event_ticker", how="left"),
    }
    # industry returns need `ingest french`; without it the table is simply not built
    french_path = paths.silver / "french_daily.parquet"
    if french_path.exists():
        tables["release_industries"] = release_industry_returns(
            surprises, pl.read_parquet(french_path)
        )
    for name, df in tables.items():
        df.write_parquet(paths.gold / f"{name}.parquet", compression="zstd")
    return {name: df.height for name, df in tables.items()}
