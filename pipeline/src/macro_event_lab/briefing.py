"""Build the release briefing JSON, iCalendar file, and Atom news feed."""

from __future__ import annotations

import calendar as std_calendar
import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

import polars as pl

from macro_event_lab.config import Paths

DEFAULT_SITE_URL = "https://aansensei.dev/macro-event-lab/"
RELEASE_BY_TARGET = {
    "gdp": "gdp",
    "cpi": "cpi",
    "payrolls": "employment_situation",
}
EMPTY_CALENDAR_SCHEMA = {
    "release": pl.String,
    "release_date": pl.Date,
    "release_ts": pl.Datetime("us", "UTC"),
    "source": pl.String,
}
ICS_MAX_OCTETS = 75
ATOM_NS = "http://www.w3.org/2005/Atom"


def _period_end(target: str, period: date) -> date:
    end_month = ((period.month - 1) // 3) * 3 + 3 if target == "gdp" else period.month
    last_day = std_calendar.monthrange(period.year, end_month)[1]
    return date(period.year, end_month, last_day)


def _format_utc_ts(value: datetime | None) -> str | None:
    if value is None:
        return None
    dt = value.astimezone(UTC) if value.tzinfo is not None else value.replace(tzinfo=UTC)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_utc_ts(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    dt = datetime.fromisoformat(normalized)
    return dt.astimezone(UTC) if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _period_label(target: str, period_iso: str) -> str:
    period_date = date.fromisoformat(period_iso)
    if target == "gdp":
        quarter = (period_date.month - 1) // 3 + 1
        return f"Q{quarter} {period_date.year}"
    return f"{period_date:%B} {period_date.year}"


def _release_summary(entry: dict[str, Any]) -> str:
    when = _period_label(str(entry["target"]), str(entry["period"]))
    return f"US {entry['label']} release, {when} data"


def _release_description(entry: dict[str, Any]) -> str:
    forecasts = entry.get("forecasts") or []
    note = "Current forecasts, preliminary results."
    if not forecasts:
        return note
    parts = "; ".join(f"{item['label']} {float(item['value']):.1f}" for item in forecasts)
    return f"{parts}\n{note}"


def _escape_ics_text(text: str) -> str:
    escaped = text.replace("\\", "\\\\")
    escaped = escaped.replace("\r\n", "\n").replace("\r", "\n")
    escaped = escaped.replace("\n", "\\n")
    escaped = escaped.replace(";", "\\;")
    escaped = escaped.replace(",", "\\,")
    return escaped


def _fold_ics_line(line: str) -> str:
    if len(line.encode("utf-8")) <= ICS_MAX_OCTETS:
        return line
    chunks: list[str] = []
    current: list[str] = []
    octet_count = 0
    for ch in line:
        ch_octets = len(ch.encode("utf-8"))
        if current and octet_count + ch_octets > ICS_MAX_OCTETS:
            chunks.append("".join(current))
            current = [" ", ch]
            octet_count = 1 + ch_octets
        else:
            current.append(ch)
            octet_count += ch_octets
    if current:
        chunks.append("".join(current))
    return "\r\n".join(chunks)


def next_first_print(
    calendar: pl.DataFrame,
    target: str,
    period: date,
) -> tuple[date, datetime] | None:
    """Return the earliest release date and UTC timestamp after the reference period end."""
    if target not in RELEASE_BY_TARGET:
        raise ValueError(f"Unknown target: {target}")
    release_name = RELEASE_BY_TARGET[target]
    end_date = _period_end(target, period)
    matched = (
        calendar.filter(
            (pl.col("release") == release_name)
            & pl.col("release_date").is_not_null()
            & (pl.col("release_date") > end_date)
        )
        .sort(["release_date", "release_ts"])
        .head(1)
    )
    if matched.is_empty():
        return None
    row = matched.row(0, named=True)
    return (row["release_date"], row["release_ts"])


def build_briefing(
    arena: dict[str, Any],
    calendar: pl.DataFrame,
    today: date,
) -> dict[str, Any]:
    """Assemble the upcoming release briefing payload from arena data and a release calendar."""
    targets_by_id = {t["id"]: t for t in arena.get("targets", [])}
    contestants = arena.get("contestants", [])
    forecasts_rows = arena.get("forecasts", [])

    releases: list[dict[str, Any]] = []
    for row in arena.get("live", []):
        target = row["target"]
        period_iso = str(row["period"])
        period_date = date.fromisoformat(period_iso)
        target_info = targets_by_id[target]

        scheduled = next_first_print(calendar, target, period_date)
        if scheduled is None:
            release_date_iso = None
            release_ts_utc = None
        else:
            release_date_val, release_ts_val = scheduled
            release_date_iso = release_date_val.isoformat()
            release_ts_utc = _format_utc_ts(release_ts_val)

        raw_values = row.get("values") or {}
        forecasts: list[dict[str, Any]] = []
        for contestant in contestants:
            cid = contestant["id"]
            if cid in raw_values and raw_values[cid] is not None:
                forecasts.append(
                    {
                        "id": cid,
                        "label": contestant["label"],
                        "kind": contestant["kind"],
                        "value": raw_values[cid],
                    }
                )

        prior_actuals = [
            f
            for f in forecasts_rows
            if f.get("target") == target
            and str(f.get("period")) < period_iso
            and f.get("actual") is not None
        ]
        last_first_print = (
            max(prior_actuals, key=lambda f: str(f["period"]))["actual"]
            if prior_actuals
            else None
        )

        releases.append(
            {
                "target": target,
                "label": target_info["label"],
                "unit": target_info["unit"],
                "period": period_iso,
                "release_date": release_date_iso,
                "release_ts_utc": release_ts_utc,
                "forecasts": forecasts,
                "last_first_print": last_first_print,
            }
        )

    releases.sort(key=lambda item: (item["release_date"] is None, item["release_date"] or ""))
    return {
        "schema_version": 1,
        "information_date": today.isoformat(),
        "releases": releases,
    }


def ics_text(briefing: dict[str, Any]) -> str:
    """Render scheduled releases in the briefing as an RFC 5545 iCalendar string."""
    info_date = date.fromisoformat(str(briefing["information_date"]))
    dtstamp = f"{info_date:%Y%m%d}T000000Z"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Macro Event Lab//Next releases//EN",
        "CALSCALE:GREGORIAN",
    ]
    for entry in briefing.get("releases", []):
        release_ts = entry.get("release_ts_utc")
        if not release_ts:
            continue
        start_dt = _parse_utc_ts(str(release_ts))
        end_dt = start_dt + timedelta(minutes=30)
        summary = _escape_ics_text(_release_summary(entry))
        description = _escape_ics_text(_release_description(entry))
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:mel-{entry['target']}-{entry['period']}@aansensei.dev",
                f"DTSTAMP:{dtstamp}",
                f"DTSTART:{start_dt:%Y%m%dT%H%M%SZ}",
                f"DTEND:{end_dt:%Y%m%dT%H%M%SZ}",
                f"SUMMARY:{summary}",
                f"DESCRIPTION:{description}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    folded = [_fold_ics_line(line) for line in lines]
    return "\r\n".join(folded) + "\r\n"


def atom_text(briefing: dict[str, Any], site_url: str = DEFAULT_SITE_URL) -> str:
    """Render the release briefing as an Atom 1.0 XML feed."""
    base_url = site_url if site_url.endswith("/") else f"{site_url}/"
    feed_url = f"{base_url}data/feed.xml"
    info_updated = f"{briefing['information_date']}T00:00:00Z"
    attr_entities = {'"': "&quot;", "'": "&apos;"}
    escaped_href = escape(feed_url, attr_entities)

    parts = [
        '<?xml version="1.0" encoding="utf-8"?>',
        f'<feed xmlns="{ATOM_NS}">',
        "  <title>Macro Event Lab: Next releases</title>",
        f"  <id>{escape(feed_url)}</id>",
        f"  <updated>{escape(info_updated)}</updated>",
        f'  <link rel="self" type="application/atom+xml" href="{escaped_href}"/>',
    ]
    for entry in briefing.get("releases", []):
        entry_id = f"{base_url}#release-{entry['target']}-{entry['period']}"
        title = _release_summary(entry)
        updated = str(entry.get("release_ts_utc") or info_updated)
        summary = _release_description(entry)
        parts.extend(
            [
                "  <entry>",
                f"    <id>{escape(entry_id)}</id>",
                f"    <title>{escape(title)}</title>",
                f"    <updated>{escape(updated)}</updated>",
                f"    <summary>{escape(summary)}</summary>",
                "  </entry>",
            ]
        )
    parts.append("</feed>")
    return "\n".join(parts) + "\n"


def write_briefing(
    paths: Paths,
    information_date: date,
    out_dir: Path | None = None,
) -> tuple[Path, Path, Path]:
    """Build and write briefing.json, calendar.ics, and feed.xml into out_dir."""
    out = paths.root / "web_public" if out_dir is None else Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    arena = json.loads((out / "arena.json").read_text(encoding="utf-8"))
    calendar_path = paths.silver / "release_calendar.parquet"
    if calendar_path.exists():
        calendar = pl.read_parquet(calendar_path)
    else:
        calendar = pl.DataFrame(schema=EMPTY_CALENDAR_SCHEMA)

    briefing = build_briefing(arena, calendar, information_date)
    json_path = out / "briefing.json"
    ics_path = out / "calendar.ics"
    feed_path = out / "feed.xml"

    json_path.write_text(json.dumps(briefing, indent=2) + "\n", encoding="utf-8", newline="\n")
    ics_path.write_text(ics_text(briefing), encoding="utf-8", newline="")
    feed_path.write_text(atom_text(briefing, DEFAULT_SITE_URL), encoding="utf-8", newline="\n")
    return (json_path, ics_path, feed_path)
