from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import polars as pl
import pytest

from macro_event_lab import cli, config, timemachine


def _write_fake_alfred(
    tmp_path: Path, rows: list[tuple[str, date, float, date, date | None]],
) -> Path:
    silver = tmp_path / "silver"
    silver.mkdir(parents=True, exist_ok=True)
    df = pl.DataFrame(
        rows,
        schema={
            "series_id": pl.String,
            "observation_date": pl.Date,
            "value": pl.Float64,
            "realtime_start": pl.Date,
            "realtime_end": pl.Date,
        },
        orient="row",
    )
    parquet_path = silver / "alfred_observations.parquet"
    df.write_parquet(parquet_path)
    return parquet_path


def _sample_rows() -> list[tuple[str, date, float, date, date | None]]:
    return [
        # Earliest overall vintage (used to test partial missing-series dates)
        ("INDPRO", date(1920, 1, 1), 10.0, date(1927, 1, 26), None),
        # GDP: Q1 and three vintages of Q2, plus a future vintage of Q3
        ("GDPC1", date(2008, 1, 1), 11646.0, date(2008, 4, 30), None),
        ("GDPC1", date(2008, 4, 1), 11700.6, date(2008, 7, 31), date(2008, 8, 27)),
        ("GDPC1", date(2008, 4, 1), 11740.3, date(2008, 8, 28), date(2008, 9, 25)),
        ("GDPC1", date(2008, 4, 1), 11727.4, date(2008, 9, 26), None),
        ("GDPC1", date(2008, 7, 1), 11720.0, date(2008, 10, 30), None),
        # CPI: July and August, plus a future September release
        ("CPIAUCSL", date(2008, 7, 1), 219.181, date(2008, 8, 14), None),
        ("CPIAUCSL", date(2008, 8, 1), 218.880, date(2008, 9, 16), None),
        ("CPIAUCSL", date(2008, 9, 1), 218.783, date(2008, 10, 16), None),
        # PAYEMS: August and September, plus a future revision on 2008-11-07
        ("PAYEMS", date(2008, 8, 1), 137477.0, date(2008, 9, 5), None),
        ("PAYEMS", date(2008, 9, 1), 137318.0, date(2008, 10, 3), date(2008, 11, 6)),
        ("PAYEMS", date(2008, 9, 1), 137200.0, date(2008, 11, 7), None),
    ]


def test_cutoff_day_is_inclusive(tmp_path: Path) -> None:
    parquet_path = _write_fake_alfred(tmp_path, _sample_rows())
    payload = json.loads(
        timemachine.run_timemachine(
            "2008-09-26",
            output_format="json",
            series_arg="GDPC1",
            parquet_path=parquet_path,
        )
    )
    gdp = payload["series"][0]
    assert gdp["latest_observation_date"] == "2008-04-01"
    assert gdp["latest_value"] == pytest.approx(11727.4)
    assert [r["realtime_start"] for r in gdp["revisions"]] == [
        "2008-07-31",
        "2008-08-28",
        "2008-09-26",
    ]


def test_later_vintage_is_ignored(tmp_path: Path) -> None:
    parquet_path = _write_fake_alfred(tmp_path, _sample_rows())
    payload = json.loads(
        timemachine.run_timemachine(
            "2008-10-15",
            output_format="json",
            parquet_path=parquet_path,
        )
    )
    by_id = {entry["series_id"]: entry for entry in payload["series"]}
    assert by_id["GDPC1"]["latest_observation_date"] == "2008-04-01"
    assert by_id["CPIAUCSL"]["latest_observation_date"] == "2008-08-01"
    assert by_id["PAYEMS"]["latest_value"] == pytest.approx(137318.0)
    assert len(by_id["PAYEMS"]["revisions"]) == 1


def test_unknown_series_exits_with_code_two(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_fake_alfred(tmp_path, _sample_rows())
    monkeypatch.setenv("MEL_DATA_DIR", str(tmp_path))
    with pytest.raises(SystemExit) as exc:
        cli.main(["timemachine", "2008-10-15", "--series", "UNKNOWN"])
    assert exc.value.code == 2
    assert "Unknown series" in capsys.readouterr().err


@pytest.mark.parametrize("bad_date", ["2008-02-30", "today", "20081015"])
def test_invalid_date_format_exits_with_code_two(
    bad_date: str, capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as exc:
        cli.main(["timemachine", bad_date])
    assert exc.value.code == 2
    assert f"Invalid date format '{bad_date}'" in capsys.readouterr().err


def test_date_before_first_vintage_exits_with_code_one(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_fake_alfred(tmp_path, _sample_rows())
    monkeypatch.setenv("MEL_DATA_DIR", str(tmp_path))
    with pytest.raises(SystemExit) as exc:
        cli.main(["timemachine", "1927-01-25"])
    assert exc.value.code == 1
    assert "1927-01-26" in capsys.readouterr().err


def test_missing_silver_dataset_exits_with_code_one(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("MEL_DATA_DIR", str(tmp_path))
    with pytest.raises(SystemExit) as exc:
        cli.main(["timemachine", "2008-10-15"])
    assert exc.value.code == 1
    assert "alfred_observations.parquet" in capsys.readouterr().err


def test_series_missing_vintage_on_date_emits_warning_and_exits_zero(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_fake_alfred(tmp_path, _sample_rows())
    monkeypatch.setenv("MEL_DATA_DIR", str(tmp_path))
    cli.main(["timemachine", "1950-01-01", "--series", "GDPC1"])
    out = capsys.readouterr().out
    expected = (
        "GDPC1: No vintage available prior to 2008-04-30; "
        "series not yet tracked in real time."
    )
    assert expected in out


def test_text_output_has_spec_headings(tmp_path: Path) -> None:
    parquet_path = _write_fake_alfred(tmp_path, _sample_rows())
    text = timemachine.run_timemachine(
        "2008-10-15", output_format="text", parquet_path=parquet_path
    )
    required_fragments = [
        "Macro Event Lab Time Machine: As of 2008-10-15",
        "[1] Real Gross Domestic Product (GDPC1)",
        "[2] Headline Consumer Price Index (CPIAUCSL)",
        "[3] Total Nonfarm Payroll Employment (PAYEMS)",
        "Latest Known Observation :",
        "Latest Published Level   :",
        "Previous Period Level    :",
        "Quarterly Growth Rate    :",
        "Monthly Inflation Rate   :",
        "Monthly Net Job Change   :",
        "Revision History for 2008 Q2 known on 2008-10-15:",
        "Revision History for 2008-08-01 known on 2008-10-15:",
        "Revision History for 2008-09-01 known on 2008-10-15:",
    ]
    for fragment in required_fragments:
        assert fragment in text


def test_json_output_matches_text_numbers(tmp_path: Path) -> None:
    parquet_path = _write_fake_alfred(tmp_path, _sample_rows())
    text = timemachine.run_timemachine(
        "2008-10-15", output_format="text", parquet_path=parquet_path
    )
    payload = json.loads(
        timemachine.run_timemachine(
            "2008-10-15", output_format="json", parquet_path=parquet_path
        )
    )
    for entry in payload["series"]:
        assert f"{entry['latest_value']:,.3f}" in text
        assert f"{entry['previous_value']:,.3f}" in text
        if entry["series_id"] == "PAYEMS":
            expected_jobs = f"{round(entry['metric_value'] * 1000.0):+,d} Jobs"
            assert expected_jobs in text
        else:
            assert f"{entry['metric_value']:+.2f}%" in text
        for rev in entry["revisions"]:
            assert f"{rev['value']:,.3f}" in text
            if rev["annualized_growth_pct"] is not None:
                assert f"{rev['annualized_growth_pct']:+.2f}%" in text


def _direct_query(df: pl.DataFrame, series_id: str, as_of: date) -> dict[str, object]:
    sub = df.filter(pl.col("series_id") == series_id)
    active = sub.filter(
        (pl.col("realtime_start") <= as_of)
        & (pl.col("realtime_end").is_null() | (pl.col("realtime_end") >= as_of))
        & pl.col("value").is_not_null()
    ).sort("observation_date", "realtime_start")
    latest_row = active.row(-1, named=True)
    prev_row = active.row(-2, named=True)
    latest_obs = latest_row["observation_date"]
    prev_obs = prev_row["observation_date"]
    revs = sub.filter(
        (pl.col("observation_date") == latest_obs)
        & (pl.col("realtime_start") <= as_of)
        & pl.col("value").is_not_null()
    ).sort("realtime_start")
    latest_val = float(latest_row["value"])
    prev_val = float(prev_row["value"])
    if series_id == "GDPC1":
        metric = ((latest_val / prev_val) ** 4 - 1.0) * 100.0
    elif series_id == "CPIAUCSL":
        metric = (latest_val / prev_val - 1.0) * 100.0
    else:
        metric = latest_val - prev_val
    return {
        "latest_obs": latest_obs.isoformat(),
        "latest_val": latest_val,
        "prev_obs": prev_obs.isoformat(),
        "prev_val": prev_val,
        "metric": metric,
        "revisions": [
            (r["realtime_start"].isoformat(), float(r["value"]))
            for r in revs.iter_rows(named=True)
        ],
    }


def _assert_matches_real_data(as_of_str: str) -> None:
    parquet_path = config.get_paths().silver / "alfred_observations.parquet"
    if not parquet_path.is_file():
        pytest.skip("silver ALFRED parquet not available")
    df = pl.read_parquet(parquet_path)
    as_of = date.fromisoformat(as_of_str)
    payload = json.loads(
        timemachine.run_timemachine(
            as_of_str, output_format="json", parquet_path=parquet_path
        )
    )
    assert payload["as_of"] == as_of_str
    for entry in payload["series"]:
        expected = _direct_query(df, entry["series_id"], as_of)
        assert entry["available"] is True
        assert entry["latest_observation_date"] == expected["latest_obs"]
        assert entry["latest_value"] == pytest.approx(expected["latest_val"])
        assert entry["previous_observation_date"] == expected["prev_obs"]
        assert entry["previous_value"] == pytest.approx(expected["prev_val"])
        assert entry["metric_value"] == pytest.approx(expected["metric"])
        got_revs = [(r["realtime_start"], r["value"]) for r in entry["revisions"]]
        assert got_revs == expected["revisions"]


def test_timemachine_financial_crisis_2008() -> None:
    _assert_matches_real_data("2008-10-15")


def test_timemachine_covid_shock_2020() -> None:
    _assert_matches_real_data("2020-04-15")


def test_timemachine_post_pandemic_2024() -> None:
    _assert_matches_real_data("2024-01-15")
