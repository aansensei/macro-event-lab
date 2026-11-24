from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import polars as pl
import pytest

from macro_event_lab import status_export
from macro_event_lab.config import Paths
from macro_event_lab.quality import Check


def write_observations(paths: Paths, vintage: date) -> None:
    paths.silver.mkdir(parents=True, exist_ok=True)
    pl.DataFrame({
        "series_id": ["CPIAUCSL", "CPIAUCSL"],
        "observation_date": [date(2025, 1, 1), date(2025, 3, 1)],
        "value": [100.0, 101.0],
        "realtime_start": [vintage, vintage],
        "realtime_end": pl.Series([None, None], dtype=pl.Date),
    }).write_parquet(paths.silver / "alfred_observations.parquet")


def test_missing_tables_publish_no_sources_or_skipped_checks(tmp_path: Path) -> None:
    result = status_export.build_status(Paths(tmp_path), date(2025, 1, 1))
    assert result["schema_version"] == 1
    assert result["information_date"] == "2025-01-01"
    assert datetime.fromisoformat(str(result["generated_at"])).tzinfo is not None
    assert result["sources"] == []
    assert result["checks"] == []


@pytest.mark.parametrize(("age", "is_fresh"), [(0, True), (7, True), (8, False), (-1, False)])
def test_alfred_freshness_uses_information_date(
    tmp_path: Path, age: int, is_fresh: bool,
) -> None:
    paths = Paths(tmp_path)
    information_date = date(2025, 4, 1)
    vintage = information_date - timedelta(days=age)
    write_observations(paths, vintage)
    result = status_export.build_status(paths, information_date)
    assert result["sources"] == [{
        "id": "alfred", "label": "ALFRED, Federal Reserve Bank of St. Louis",
        "latest_vintage_date": vintage.isoformat(), "series_count": 1, "rows": 2,
        "max_age_days": 7, "is_fresh": is_fresh,
    }]
    checks = {check["name"]: check for check in result["checks"]}
    assert set(checks) == {"duplicates_alfred_observations", "missing_observations"}
    assert checks["missing_observations"]["status"] == "warn"
    assert checks["missing_observations"]["problems"] == 1
    assert checks["duplicates_alfred_observations"]["status"] == "pass"


@pytest.mark.parametrize("published_at", [
    datetime(2025, 2, 21, 4, 59, 59, tzinfo=UTC),
    datetime(2025, 5, 16, 3, 59, 59, tzinfo=UTC),
])
@pytest.mark.parametrize(("age", "is_fresh"), [(120, True), (121, False)])
def test_spf_date_uses_new_york_calendar_and_120_day_threshold(
    tmp_path: Path, published_at: datetime, age: int, is_fresh: bool,
) -> None:
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    pl.DataFrame({
        "survey_year": [2025], "survey_quarter": [1 if published_at.month == 2 else 2],
        "variable": ["gdp"], "horizon": [0], "statistic": ["median"], "value": [2.0],
        "unit": ["percent annualized q/q"], "known_from": [published_at],
        "known_from_source": ["official_release_date"],
    }).write_parquet(paths.silver / "spf_forecasts.parquet")
    published_date = published_at.date() - timedelta(days=1)
    result = status_export.build_status(paths, published_date + timedelta(days=age))
    assert result["sources"][0]["latest_vintage_date"] == published_date.isoformat()
    assert result["sources"][0]["is_fresh"] is is_fresh
    assert result["sources"][0]["max_age_days"] == 120
    assert result["checks"][0]["name"] == "spf_forecasts"
    assert result["checks"][0]["status"] == "pass"


def test_only_allowed_checks_run_and_records_are_not_exported(tmp_path: Path) -> None:
    paths = Paths(tmp_path)
    write_observations(paths, date(2025, 4, 1))
    frame = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    pl.concat([frame, frame.head(1)]).write_parquet(paths.silver / "alfred_observations.parquet")
    result = status_export.build_status(paths, date(2025, 4, 1))
    duplicate_check = next(check for check in result["checks"]
                           if check["name"] == "duplicates_alfred_observations")
    assert duplicate_check["status"] == "fail" and duplicate_check["problems"] == 1
    assert set(duplicate_check) == {"name", "status", "problems", "description"}
    assert all(check["name"] in status_export.PUBLIC_CHECK_NAMES for check in result["checks"])


def test_restricted_description_fails_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(status_export, "CHECKS", [Check(
        "missing_observations", "warn", "private market prices", "SELECT 1",
    )])
    with pytest.raises(ValueError, match="restricted"):
        status_export.build_status(Paths(tmp_path), date(2025, 1, 1))


def test_empty_source_table_does_not_invent_a_vintage(tmp_path: Path) -> None:
    paths = Paths(tmp_path)
    write_observations(paths, date(2025, 4, 1))
    frame = pl.read_parquet(paths.silver / "alfred_observations.parquet")
    frame.clear().write_parquet(paths.silver / "alfred_observations.parquet")
    result = status_export.build_status(paths, date(2025, 4, 1))
    assert result["sources"] == []
