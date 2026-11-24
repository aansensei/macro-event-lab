"""Median professional forecasts and their official publication calendar."""

from __future__ import annotations

import calendar
import io
import math
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import iter_manifest, load_raw_bytes, save_raw

BASE_URL = (
    "https://www.philadelphiafed.org/-/media/FRBP/Assets/Surveys-And-Data/"
    "survey-of-professional-forecasters"
)
FILES = {
    "levels": "historical-data/medianLevel.xlsx",
    "growth": "historical-data/medianGrowth.xlsx",
    "calendar": "spf-release-dates.txt",
}
WORKBOOK_KIND = "spf.workbook"
CALENDAR_KIND = "spf.calendar"
ATTRIBUTION = "Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF)"
FORECAST_KEY = ["survey_year", "survey_quarter", "variable", "horizon", "statistic"]
MISSING_VALUES = {-999.0, -999.9, -999.99}


@dataclass(frozen=True)
class SurveyRelease:
    deadline: date | None
    news_release_date: date | None


@dataclass(frozen=True)
class Variable:
    workbook: str
    sheet: str
    variable: str
    unit: str
    # growth columns carry a prefix that differs from the sheet name (sheet RGDP, columns DRGDP2)
    column_prefix: str = ""


VARIABLES = (
    Variable("growth", "RGDP", "gdp", "% annualized q/q", "DRGDP"),
    Variable("levels", "CPI", "cpi", "% annualized q/q"),
    Variable("levels", "CORECPI", "core_cpi", "% annualized q/q"),
    Variable("levels", "UNEMP", "unemployment", "%"),
    Variable("levels", "EMP", "payrolls", "thousands of jobs, quarterly average"),
    Variable("levels", "HOUSING", "housing_starts", "millions of units, annual rate"),
    Variable("levels", "INDPROD", "industrial_production", "index"),
)


def ingest_file(
    client: RateLimitedClient, raw_dir: Path, name: str, *, refresh: bool = False,
) -> int:
    """Save one approved source file, resuming from a complete local copy by default."""
    if name not in FILES:
        raise ValueError(f"Unknown SPF file: {name}")
    kind = CALENDAR_KIND if name == "calendar" else WORKBOOK_KIND
    if not refresh:
        for record in reversed(list(iter_manifest(raw_dir))):
            if record.kind == kind and record.meta.get("name") == name:
                return len(load_raw_bytes(raw_dir, record))
    response = client.get(f"/{FILES[name]}")
    save_raw(
        raw_dir, kind, str(response.url), None, response.content,
        meta={"name": name, "file": FILES[name], "attribution": ATTRIBUTION},
        suffix=".txt" if name == "calendar" else ".xlsx",
    )
    return len(response.content)


def _calendar_date(token: str) -> date | None:
    token = token.rstrip("*")
    if not re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4}", token):
        return None
    month, day, year = map(int, token.split("/"))
    if year < 100:
        year += 1900 if year >= 68 else 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_release_dates(text: str) -> dict[tuple[int, int], SurveyRelease]:
    """Read Deadline and News Release columns separately, retaining invalid chronology."""
    surveys: dict[tuple[int, int], SurveyRelease] = {}
    survey_year: int | None = None
    for line in text.splitlines():
        match = re.match(r"^\s*(?:(\d{4})\s+)?Q([1-4])\s+(.*)$", line)
        if match is None:
            continue
        if match[1] is not None:
            survey_year = int(match[1])
        if survey_year is None:
            raise ValueError("SPF calendar quarter has no survey year")
        key = (survey_year, int(match[2]))
        if key in surveys:
            raise ValueError(f"Duplicate SPF calendar survey: {key}")
        columns = match[3].split()
        deadline = _calendar_date(columns[0]) if columns else None
        release = _calendar_date(columns[1]) if len(columns) > 1 else None
        surveys[key] = SurveyRelease(deadline, release)
    if not surveys:
        raise ValueError("SPF calendar contains no survey rows")
    return surveys


def publication_time(
    survey_year: int, survey_quarter: int, release: SurveyRelease | None,
) -> tuple[datetime, str]:
    """Use release-day end in New York, or the approved conservative fallback."""
    if survey_quarter not in (1, 2, 3, 4):
        raise ValueError("SPF survey quarter must be between 1 and 4")
    quarter_start = date(survey_year, 3 * survey_quarter - 2, 1)
    last_month = 3 * survey_quarter
    quarter_end = date(survey_year, last_month, calendar.monthrange(survey_year, last_month)[1])
    deadline = release.deadline if release else None
    news_date = release.news_release_date if release else None
    if news_date is None:
        reason = "missing_news_release_date"
    elif deadline is not None and news_date < deadline:
        reason = "news_release_before_deadline"
    elif news_date < quarter_start:
        reason = "news_release_before_survey_quarter"
    else:
        reason = ""
    if reason:
        day = max(quarter_end, deadline) if deadline else quarter_end
        source = f"conservative_quarter_end_or_deadline:{reason}:America/New_York"
    else:
        day = news_date
        source = "spf_news_release_date:end_of_day:America/New_York"
    moment = datetime.combine(day, time(23, 59, 59), ZoneInfo("America/New_York"))
    return moment.astimezone(UTC), source


def parse_workbook(
    body: bytes, name: str, releases: dict[tuple[int, int], SurveyRelease],
) -> list[dict[str, Any]]:
    """Keep quarterly median forecasts, excluding jump-off and annual columns."""
    if name not in {"levels", "growth"}:
        raise ValueError(f"Unknown SPF workbook: {name}")
    from openpyxl import load_workbook

    workbook = load_workbook(io.BytesIO(body), read_only=True, data_only=True)
    forecasts: list[dict[str, Any]] = []
    try:
        sheet_names = {sheet.upper(): sheet for sheet in workbook.sheetnames}
        for variable in VARIABLES:
            if variable.workbook != name or variable.sheet not in sheet_names:
                continue
            worksheet = workbook[sheet_names[variable.sheet]]
            headers: dict[int, int] | None = None
            for cells in worksheet.iter_rows(values_only=True):
                labels = [str(cell).strip().upper() if cell is not None else "" for cell in cells]
                if len(labels) >= 2 and labels[0] == "YEAR" and labels[1] in {"QUARTER", "QTR"}:
                    headers = {}
                    for index, label in enumerate(labels[2:], 2):
                        prefix = re.escape(variable.column_prefix or variable.sheet)
                        match = re.fullmatch(prefix + r"([2-6])", label)
                        if match:
                            headers[index] = int(match[1]) - 2
                    if not headers:
                        raise ValueError(
                            f"SPF sheet {variable.sheet} has no quarterly forecast columns"
                        )
                    continue
                if headers is None or not cells or cells[0] is None:
                    continue
                if len(cells) < 2 or cells[1] is None:
                    raise ValueError(f"SPF sheet {variable.sheet} has an incomplete survey key")
                survey_year, survey_quarter = int(cells[0]), int(cells[1])
                if cells[0] != survey_year or cells[1] != survey_quarter:
                    raise ValueError("SPF survey year and quarter must be integers")
                known_from, known_from_source = publication_time(
                    survey_year, survey_quarter, releases.get((survey_year, survey_quarter)),
                )
                for index, horizon in headers.items():
                    cell = cells[index] if index < len(cells) else None
                    if cell is None or str(cell).strip() in {"", "#N/A", "NA", "N/A", "."}:
                        continue
                    if isinstance(cell, bool):
                        raise ValueError(f"SPF {variable.sheet}: forecast must be numeric")
                    try:
                        value = float(cell)
                    except (TypeError, ValueError) as error:
                        raise ValueError(
                            f"SPF {variable.sheet}: forecast must be numeric"
                        ) from error
                    if value in MISSING_VALUES:
                        continue
                    if not math.isfinite(value):
                        raise ValueError(f"SPF {variable.sheet}: forecast must be finite")
                    forecasts.append({
                        "survey_year": survey_year, "survey_quarter": survey_quarter,
                        "variable": variable.variable, "horizon": horizon, "statistic": "median",
                        "value": value, "unit": variable.unit, "known_from": known_from,
                        "known_from_source": known_from_source,
                    })
            if headers is None:
                raise ValueError(f"SPF sheet {variable.sheet} has no Year and Quarter header")
    finally:
        workbook.close()
    if not forecasts:
        raise ValueError(f"SPF {name} workbook contains no supported quarterly forecasts")
    return forecasts
