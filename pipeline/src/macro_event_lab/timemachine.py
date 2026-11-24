"""Point-in-time historical state lookup for macro releases in ALFRED."""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import polars as pl

from macro_event_lab.nowcast import vintage

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SUPPORTED_SERIES = ("GDPC1", "CPIAUCSL", "PAYEMS")


@dataclass(frozen=True)
class SeriesSpec:
    series_id: str
    title: str
    unit: str
    metric_label: str
    metric_suffix: str


SERIES_SPECS: dict[str, SeriesSpec] = {
    "GDPC1": SeriesSpec(
        series_id="GDPC1",
        title="Real Gross Domestic Product",
        unit="Billion Chained 2000 Dollars",
        metric_label="Quarterly Growth Rate",
        metric_suffix=" (annualized pace)",
    ),
    "CPIAUCSL": SeriesSpec(
        series_id="CPIAUCSL",
        title="Headline Consumer Price Index",
        unit="Index 1982-1984=100",
        metric_label="Monthly Inflation Rate",
        metric_suffix=" (month on month)",
    ),
    "PAYEMS": SeriesSpec(
        series_id="PAYEMS",
        title="Total Nonfarm Payroll Employment",
        unit="Thousands of Jobs",
        metric_label="Monthly Net Job Change",
        metric_suffix="",
    ),
}


@dataclass(frozen=True)
class RevisionEntry:
    realtime_start: str
    label: str
    value: float
    annualized_growth_pct: float | None = None


@dataclass(frozen=True)
class SeriesSnapshot:
    series_id: str
    title: str
    unit: str
    available: bool
    earliest_vintage: str | None
    missing_message: str | None
    latest_observation_date: str | None
    latest_period_label: str | None
    latest_value: float | None
    previous_observation_date: str | None
    previous_period_label: str | None
    previous_value: float | None
    metric_name: str | None
    metric_value: float | None
    revisions: list[RevisionEntry]


def parse_as_of_date(value: str) -> date:
    """Parse an ISO calendar date string (YYYY-MM-DD) or exit with code 2."""
    if not DATE_RE.match(value):
        print(f"Error: Invalid date format '{value}'. Expected YYYY-MM-DD.", file=sys.stderr)
        raise SystemExit(2)
    try:
        return date.fromisoformat(value)
    except ValueError:
        print(f"Error: Invalid date format '{value}'. Expected YYYY-MM-DD.", file=sys.stderr)
        raise SystemExit(2) from None


def parse_series_list(value: str | None) -> list[str]:
    """Parse comma-separated target series identifiers or exit with code 2."""
    if value is None:
        return list(SUPPORTED_SERIES)
    items = [part.strip() for part in value.split(",") if part.strip()]
    if not items:
        allowed = ", ".join(SUPPORTED_SERIES)
        print(
            f"Error: Unknown series '{value}'. Expected one or more of {allowed}.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    unknown = [item for item in items if item not in SERIES_SPECS]
    if unknown:
        allowed = ", ".join(SUPPORTED_SERIES)
        bad = ", ".join(unknown)
        print(f"Error: Unknown series '{bad}'. Expected values from {allowed}.", file=sys.stderr)
        raise SystemExit(2)
    return list(dict.fromkeys(items))


def load_alfred_table(parquet_path: Path) -> pl.DataFrame:
    """Load the ALFRED silver Parquet table or exit with code 1 when missing."""
    if not parquet_path.is_file():
        print(
            "Error: Dataset 'data/silver/alfred_observations.parquet' not found. "
            "Run 'ingest alfred' and 'build' first.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return pl.read_parquet(parquet_path)


def format_period_label(series_id: str, obs_date: date) -> str:
    """Format an observation date as a human-readable quarter or month label."""
    if series_id == "GDPC1":
        quarter = (obs_date.month - 1) // 3 + 1
        return f"{obs_date.year} Q{quarter}"
    return obs_date.strftime("%B %Y")


def _compute_metric(series_id: str, latest_val: float, prev_val: float) -> tuple[str, float]:
    if series_id == "GDPC1":
        return "annualized_growth_pct", ((latest_val / prev_val) ** 4 - 1.0) * 100.0
    if series_id == "CPIAUCSL":
        return "monthly_inflation_pct", (latest_val / prev_val - 1.0) * 100.0
    return "net_job_change_thousands", latest_val - prev_val


def _revision_label(series_id: str, index: int) -> str:
    if series_id == "GDPC1":
        labels = ("Advance", "Preliminary", "Final")
        return labels[index] if index < len(labels) else "Revision"
    return "Initial" if index == 0 else "Revision"


def build_series_snapshot(
    observations: pl.DataFrame, series_id: str, as_of: date,
) -> SeriesSnapshot:
    """Reconstruct the latest known observation, prior period, and revisions on `as_of`."""
    spec = SERIES_SPECS[series_id]
    series_df = observations.filter(pl.col("series_id") == series_id).sort("realtime_start")
    earliest = series_df["realtime_start"].min() if not series_df.is_empty() else None
    earliest_str = earliest.isoformat() if isinstance(earliest, date) else None

    known = vintage(series_df, as_of)
    if not known:
        if earliest_str is not None:
            msg = (
                f"{series_id}: No vintage available prior to {earliest_str}; "
                "series not yet tracked in real time."
            )
        else:
            msg = f"{series_id}: No vintage available on {as_of.isoformat()}."
        return SeriesSnapshot(
            series_id=series_id,
            title=spec.title,
            unit=spec.unit,
            available=False,
            earliest_vintage=earliest_str,
            missing_message=msg,
            latest_observation_date=None,
            latest_period_label=None,
            latest_value=None,
            previous_observation_date=None,
            previous_period_label=None,
            previous_value=None,
            metric_name=None,
            metric_value=None,
            revisions=[],
        )

    ordered_dates = sorted(known)
    latest_obs = ordered_dates[-1]
    latest_val = float(known[latest_obs])
    prev_obs = ordered_dates[-2] if len(ordered_dates) >= 2 else None
    prev_val = float(known[prev_obs]) if prev_obs is not None else None

    metric_name: str | None = None
    metric_value: float | None = None
    if prev_val is not None:
        metric_name, metric_value = _compute_metric(series_id, latest_val, prev_val)

    rev_rows = series_df.filter(
        (pl.col("observation_date") == latest_obs)
        & (pl.col("realtime_start") <= as_of)
        & pl.col("value").is_not_null()
    ).sort("realtime_start")

    revisions: list[RevisionEntry] = []
    for idx, row in enumerate(rev_rows.iter_rows(named=True)):
        rev_date = row["realtime_start"]
        rev_val = float(row["value"])
        rev_growth: float | None = None
        if series_id == "GDPC1" and prev_obs is not None:
            rev_vintage = vintage(series_df, rev_date)
            rev_prev = rev_vintage.get(prev_obs)
            if rev_prev is not None:
                rev_growth = ((rev_val / float(rev_prev)) ** 4 - 1.0) * 100.0
        revisions.append(
            RevisionEntry(
                realtime_start=rev_date.isoformat(),
                label=_revision_label(series_id, idx),
                value=rev_val,
                annualized_growth_pct=rev_growth,
            )
        )

    return SeriesSnapshot(
        series_id=series_id,
        title=spec.title,
        unit=spec.unit,
        available=True,
        earliest_vintage=earliest_str,
        missing_message=None,
        latest_observation_date=latest_obs.isoformat(),
        latest_period_label=format_period_label(series_id, latest_obs),
        latest_value=latest_val,
        previous_observation_date=prev_obs.isoformat() if prev_obs is not None else None,
        previous_period_label=format_period_label(series_id, prev_obs) if prev_obs else None,
        previous_value=prev_val,
        metric_name=metric_name,
        metric_value=metric_value,
        revisions=revisions,
    )


def build_timemachine(
    observations: pl.DataFrame, as_of: date, series: list[str] | None = None,
) -> dict[str, object]:
    """Validate `as_of` against earliest ALFRED vintage and build snapshots for requested series."""
    selected = list(SUPPORTED_SERIES) if series is None else series
    earliest = observations["realtime_start"].min() if not observations.is_empty() else None
    if not isinstance(earliest, date):
        print(
            f"Error: Date {as_of.isoformat()} precedes the earliest recorded ALFRED vintage "
            "(none).",
            file=sys.stderr,
        )
        raise SystemExit(1)
    if as_of < earliest:
        print(
            f"Error: Date {as_of.isoformat()} precedes the earliest recorded ALFRED vintage "
            f"({earliest.isoformat()}).",
            file=sys.stderr,
        )
        raise SystemExit(1)

    snapshots = [build_series_snapshot(observations, series_id, as_of) for series_id in selected]
    return {
        "as_of": as_of.isoformat(),
        "series": [asdict(snapshot) for snapshot in snapshots],
    }


def _format_metric_text(series_id: str, metric_value: float | None, suffix: str) -> str:
    if metric_value is None:
        return "N/A"
    if series_id == "PAYEMS":
        jobs = round(metric_value * 1000.0)
        return f"{jobs:+,d} Jobs"
    return f"{metric_value:+.2f}%{suffix}"


def format_text(payload: dict[str, object]) -> str:
    """Format the timemachine payload as aligned terminal text."""
    as_of = str(payload["as_of"])
    lines = [f"Macro Event Lab Time Machine: As of {as_of}"]
    series_items = payload["series"]
    assert isinstance(series_items, list)

    for idx, item in enumerate(series_items, start=1):
        lines.append("")
        series_id = str(item["series_id"])
        spec = SERIES_SPECS[series_id]
        if not item["available"]:
            lines.append(str(item["missing_message"]))
            continue

        lines.append(f"[{idx}] {spec.title} ({series_id})")
        latest_label = item["latest_period_label"]
        latest_date = item["latest_observation_date"]
        latest_val = float(item["latest_value"])
        lines.append(f"  Latest Known Observation : {latest_label} ({latest_date})")
        lines.append(f"  Latest Published Level   : {latest_val:,.3f} {spec.unit}")

        prev_val = item["previous_value"]
        prev_label = item["previous_period_label"]
        if prev_val is not None and prev_label is not None:
            lines.append(f"  Previous Period Level    : {float(prev_val):,.3f} ({prev_label})")
        else:
            lines.append("  Previous Period Level    : N/A")

        metric_str = _format_metric_text(series_id, item["metric_value"], spec.metric_suffix)
        lines.append(f"  {spec.metric_label:<25}: {metric_str}")

        history_target = latest_label if series_id == "GDPC1" else latest_date
        lines.append(f"  Revision History for {history_target} known on {as_of}:")
        revisions = item["revisions"]
        label_width = max((len(str(rev["label"])) + 2 for rev in revisions), default=0)
        for rev in revisions:
            tag = f"({rev['label']})"
            val_str = f"{float(rev['value']):,.3f}"
            growth = rev.get("annualized_growth_pct")
            suffix = f" ({float(growth):+.2f}%)" if growth is not None else ""
            lines.append(f"    * {rev['realtime_start']} {tag:<{label_width}} : {val_str}{suffix}")

    return "\n".join(lines)


def format_json(payload: dict[str, object]) -> str:
    """Format the timemachine payload as indented JSON."""
    return json.dumps(payload, indent=2)


def run_timemachine(
    date_str: str,
    *,
    output_format: str = "text",
    series_arg: str | None = None,
    parquet_path: Path,
) -> str:
    """Run the timemachine lookup and return formatted output."""
    as_of = parse_as_of_date(date_str)
    selected = parse_series_list(series_arg)
    observations = load_alfred_table(parquet_path)
    payload = build_timemachine(observations, as_of, selected)
    if output_format == "json":
        return format_json(payload)
    return format_text(payload)
