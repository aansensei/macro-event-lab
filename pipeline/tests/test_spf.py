from __future__ import annotations

import argparse
import importlib.util
import io
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path
from unittest.mock import Mock
from zoneinfo import ZoneInfo

import duckdb
import httpx
import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab import cli
from macro_event_lab.build import SPF_SCHEMA, build_silver
from macro_event_lab.config import Paths
from macro_event_lab.http import RateLimitedClient
from macro_event_lab.quality import run_checks
from macro_event_lab.raw_store import iter_manifest, load_raw_bytes, save_raw
from macro_event_lab.sources import spf

CALENDAR = """Survey  True Deadline Date  News Release Date
2003 Q1  2/14/03  2/24/03
     Q2  5/12/03  5/20/03
"""
NEEDS_WORKBOOK_READER = pytest.mark.skipif(
    importlib.util.find_spec("openpyxl") is None, reason="openpyxl is not installed",
)


def workbook_fixture(sheet: str = "CPI", first_value: float = 1.0) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '''
          <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
            <Default Extension="rels"
              ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
            <Default Extension="xml" ContentType="application/xml"/>
            <Override PartName="/xl/workbook.xml"
              ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
            <Override PartName="/xl/worksheets/sheet1.xml"
              ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
          </Types>''')
        archive.writestr("_rels/.rels", '''
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Target="xl/workbook.xml"
              Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>
          </Relationships>''')
        archive.writestr("xl/workbook.xml", f'''
          <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
            <sheets><sheet name="{sheet}" sheetId="1" r:id="rId1"/></sheets>
          </workbook>''')
        archive.writestr("xl/_rels/workbook.xml.rels", '''
          <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
            <Relationship Id="rId1" Target="worksheets/sheet1.xml"
              Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>
          </Relationships>''')
        archive.writestr("xl/worksheets/sheet1.xml", f'''
          <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
            <row r="1">
              <c r="A1" t="inlineStr"><is><t>YEAR</t></is></c>
              <c r="B1" t="inlineStr"><is><t>QUARTER</t></is></c>
              <c r="C1" t="inlineStr"><is><t>{sheet}1</t></is></c>
              <c r="D1" t="inlineStr"><is><t>{sheet}2</t></is></c>
              <c r="E1" t="inlineStr"><is><t>{sheet}3</t></is></c>
              <c r="F1" t="inlineStr"><is><t>{sheet}A</t></is></c>
            </row>
            <row r="2">
              <c r="A2"><v>2003</v></c><c r="B2"><v>1</v></c><c r="C2"><v>99</v></c>
              <c r="D2"><v>{first_value}</v></c><c r="E2"><v>2</v></c>
              <c r="F2"><v>88</v></c>
            </row>
            <row r="3">
              <c r="A3"><v>2003</v></c><c r="B3"><v>2</v></c><c r="C3"><v>99</v></c>
              <c r="D3"><v>3</v></c><c r="E3"><v>-999</v></c><c r="F3"><v>88</v></c>
            </row>
          </sheetData></worksheet>''')
    return buffer.getvalue()


def test_workbook_fixture_is_a_self_contained_two_survey_workbook() -> None:
    with zipfile.ZipFile(io.BytesIO(workbook_fixture())) as archive:
        assert "xl/workbook.xml" in archive.namelist()
        assert b'row r="3"' in archive.read("xl/worksheets/sheet1.xml")


def test_ingestion_saves_exact_bytes_and_resumes_from_the_local_store(tmp_path: Path) -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(200, content=b"fixture bytes"))
    with RateLimitedClient(spf.BASE_URL, 1000, transport=transport) as client:
        get = Mock(wraps=client.get)
        client.get = get
        assert spf.ingest_file(client, tmp_path, "levels") == 13
        assert spf.ingest_file(client, tmp_path, "levels") == 13
        assert get.call_count == 1
        spf.ingest_file(client, tmp_path, "levels", refresh=True)
        assert get.call_count == 2
        with pytest.raises(ValueError, match="Unknown SPF file"):
            spf.ingest_file(client, tmp_path, "unknown")
    records = list(iter_manifest(tmp_path))
    assert len(records) == 2
    assert records[0].sha256 == records[1].sha256
    assert records[0].path.endswith(".xlsx.gz")
    assert load_raw_bytes(tmp_path, records[0]) == b"fixture bytes"
    assert records[0].meta["attribution"] == spf.ATTRIBUTION


@pytest.mark.parametrize(
    ("token", "expected"),
    [("5/20/03", date(2003, 5, 20)), ("3/6/2026**", date(2026, 3, 6)),
     ("8/31/90*", date(1990, 8, 31)), ("NA", None), ("2/30/03", None)],
)
def test_calendar_dates_accept_footnotes_and_leave_invalid_dates_missing(
    token: str, expected: date | None,
) -> None:
    assert spf._calendar_date(token) == expected


def test_release_calendar_uses_the_news_release_column_and_carries_the_year() -> None:
    surveys = spf.parse_release_dates(CALENDAR)
    assert surveys[(2003, 2)] == spf.SurveyRelease(date(2003, 5, 12), date(2003, 5, 20))
    with pytest.raises(ValueError, match="Duplicate"):
        spf.parse_release_dates(CALENDAR + "2003 Q2  5/12/03  5/20/03\n")
    with pytest.raises(ValueError, match="no survey year"):
        spf.parse_release_dates("Q2  5/12/03  5/20/03")
    with pytest.raises(ValueError, match="no survey rows"):
        spf.parse_release_dates("unrecognized fixture")


def test_publication_uses_the_release_date_at_end_of_day_not_the_deadline() -> None:
    moment, source = spf.publication_time(2003, 2, spf.parse_release_dates(CALENDAR)[(2003, 2)])
    assert moment == datetime(2003, 5, 21, 3, 59, 59, tzinfo=UTC)
    assert source.startswith("spf_news_release_date")


def test_release_before_deadline_uses_the_approved_fallback_and_records_why() -> None:
    release = spf.SurveyRelease(date(2003, 5, 12), date(2003, 2, 20))
    moment, source = spf.publication_time(2003, 2, release)
    assert moment == datetime(2003, 7, 1, 3, 59, 59, tzinfo=UTC)
    assert "news_release_before_deadline" in source


def test_missing_release_uses_the_later_of_quarter_end_and_deadline() -> None:
    moment, source = spf.publication_time(2003, 2, spf.SurveyRelease(date(2003, 7, 10), None))
    assert moment == datetime(2003, 7, 11, 3, 59, 59, tzinfo=UTC)
    assert "missing_news_release_date" in source
    assert spf.publication_time(2003, 2, None)[0] == datetime(2003, 7, 1, 3, 59, 59, tzinfo=UTC)
    with pytest.raises(ValueError, match="quarter"):
        spf.publication_time(2003, 0, None)


def test_release_before_the_survey_quarter_without_a_deadline_is_conservative() -> None:
    moment, source = spf.publication_time(2003, 2, spf.SurveyRelease(None, date(2003, 2, 20)))
    assert moment == datetime(2003, 7, 1, 3, 59, 59, tzinfo=UTC)
    assert "news_release_before_survey_quarter" in source


@given(st.integers(1968, 2100), st.integers(1, 4))
def test_fallback_never_predates_the_survey_quarter(year: int, quarter: int) -> None:
    moment, _ = spf.publication_time(year, quarter, None)
    local_day = moment.astimezone(ZoneInfo("America/New_York")).date()
    assert local_day >= date(year, quarter * 3 - 2, 1)


@NEEDS_WORKBOOK_READER
def test_two_survey_workbook_excludes_history_annual_horizons_and_missing_codes() -> None:
    rows = spf.parse_workbook(workbook_fixture(), "levels", spf.parse_release_dates(CALENDAR))
    assert [(row["survey_quarter"], row["horizon"], row["value"]) for row in rows] == [
        (1, 0, 1), (1, 1, 2), (2, 0, 3),
    ]
    assert {row["variable"] for row in rows} == {"cpi"}
    assert {row["unit"] for row in rows} == {"% annualized q/q"}
    assert all(row["statistic"] == "median" for row in rows)


@NEEDS_WORKBOOK_READER
@pytest.mark.parametrize("variable", spf.VARIABLES)
def test_workbook_preserves_each_variables_published_unit(variable: spf.Variable) -> None:
    rows = spf.parse_workbook(
        workbook_fixture(variable.sheet), variable.workbook, spf.parse_release_dates(CALENDAR),
    )
    assert {row["variable"] for row in rows} == {variable.variable}
    assert {row["unit"] for row in rows} == {variable.unit}
    assert [row["horizon"] for row in rows] == [0, 1, 0]


@NEEDS_WORKBOOK_READER
def test_silver_build_uses_the_latest_workbook_and_the_calendar(tmp_path: Path) -> None:
    paths = Paths(tmp_path)
    for day, value in ((1, 1.0), (2, 4.0)):
        moment = datetime(2026, 1, day, tzinfo=UTC)
        save_raw(paths.raw, spf.WORKBOOK_KIND, "fixture", None, workbook_fixture(first_value=value),
                 {"name": "levels"}, now=moment, suffix=".xlsx")
    save_raw(paths.raw, spf.CALENDAR_KIND, "fixture", None, CALENDAR.encode(),
             {"name": "calendar"}, suffix=".txt")
    assert build_silver(paths)["spf_forecasts"] == 3
    forecasts = pl.read_parquet(paths.silver / "spf_forecasts.parquet")
    assert forecasts.schema == pl.Schema(SPF_SCHEMA)
    assert forecasts["value"][0] == 4.0
    assert forecasts["known_from"][2].date() == date(2003, 5, 21)


def test_survey_quality_rejects_duplicates_nonfinite_values_and_early_timestamps() -> None:
    base = {"survey_year": 2003, "survey_quarter": 2, "variable": "cpi", "horizon": 0,
            "statistic": "median", "value": 1.0, "unit": "%", "known_from_source": "fixture",
            "known_from": datetime(2003, 5, 21, tzinfo=UTC)}
    connection = duckdb.connect()
    connection.register("spf_forecasts", pl.DataFrame([base], schema=SPF_SCHEMA))
    assert next(result for result in run_checks(connection)
                if result.check.name == "spf_forecasts").status == "PASS"
    bad = [base, base, {**base, "horizon": 1, "value": float("nan")},
           {**base, "horizon": 2, "known_from": datetime(2003, 3, 31, tzinfo=UTC)}]
    connection.register("spf_forecasts", pl.DataFrame(bad, schema=SPF_SCHEMA))
    result = next(
        result for result in run_checks(connection) if result.check.name == "spf_forecasts"
    )
    assert result.status == "FAIL"
    assert result.problems is not None and result.problems.height == 4


def test_ingest_command_requests_only_approved_files_in_calendar_first_order(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(cli.config, "get_paths", lambda: Paths(tmp_path))
    ingest = Mock(return_value=1)
    monkeypatch.setattr(spf, "ingest_file", ingest)
    cli.main(["ingest", "spf"])
    assert [call.args[2] for call in ingest.call_args_list] == ["calendar", "levels", "growth"]
    assert all(call.kwargs == {"refresh": False} for call in ingest.call_args_list)
    assert "spf-release-dates.txt" in capsys.readouterr().out


def test_check_command_registers_the_survey_table(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    paths = Paths(tmp_path)
    paths.silver.mkdir(parents=True)
    pl.DataFrame(schema=SPF_SCHEMA).write_parquet(paths.silver / "spf_forecasts.parquet")
    monkeypatch.setattr(cli.config, "get_paths", lambda: paths)
    cli.cmd_check(argparse.Namespace(show=1))
    assert "PASS  spf_forecasts" in capsys.readouterr().out
