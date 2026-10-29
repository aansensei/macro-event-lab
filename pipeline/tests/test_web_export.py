import json
from datetime import UTC, date, datetime, timedelta

import polars as pl
import pytest

from macro_event_lab.config import Paths
from macro_event_lab.gold import REVISION_SCHEMA
from macro_event_lab.web_export import (
    build_web,
    event_id,
    event_title,
    revisions_payload,
    summary_payload,
)

CLOSE = datetime(2026, 10, 14, 12, 29, tzinfo=UTC)
TS = pl.Datetime("us", "UTC")


@pytest.mark.parametrize(
    ("ticker", "expected"),
    [
        ("KXCPI-26SEP", "kxcpi-26sep"),
        ("GDP-232022 Q4", "gdp-232022-q4"),
        ("PROLLS-23DECB", "prolls-23decb"),
    ],
)
def test_event_id_is_file_safe(ticker, expected):
    assert event_id(ticker) == expected


@pytest.mark.parametrize(
    ("series", "period", "expected"),
    [
        ("KXCPI", date(2026, 9, 1), "CPI, September 2026"),
        ("KXPAYROLLS", date(2025, 9, 1), "Jobs, September 2025"),
        ("KXGDP", date(2025, 7, 1), "GDP, Q3 2025"),
        ("KXFED", None, "FOMC, October 2026"),  # named after the month it closes in
        ("KXCPI", None, "CPI, October 2026"),
    ],
)
def test_event_title(series, period, expected):
    assert event_title(series, period, CLOSE) == expected


def _gold(tmp_path) -> Paths:
    paths = Paths(tmp_path)
    paths.gold.mkdir(parents=True)
    pl.DataFrame([{
        "series_ticker": "KXCPI", "event_ticker": "KXCPI-26SEP", "close": CLOSE,
        "release_date": date(2026, 10, 14), "reference_period": date(2026, 9, 1),
        "match_method": "reference_period", "first_print": 0.6, "first_print_source": "alfred",
        "settled_value": 0.6, "mean_t1h": 0.571, "sd_t1h": 0.123,
        "surprise": 0.029, "surprise_sd": 0.2357723577,
        "reaction_date": date(2026, 10, 14), "reaction_prev_date": date(2026, 10, 13),
        "dgs2_change_bp": 6.0, "dgs10_change_bp": 4.0,
        "in_50": True, "in_90": True, "surprise_rank_pct": 0.25, "series_n": 41,
        "series_hit_50": 0.51, "series_hit_90": 0.88, "yield_n": 39,
        "dgs2_bp_per_sd": 2.1234567, "dgs10_bp_per_sd": 1.5, "dgs2_corr": 0.42, "dgs10_corr": 0.3,
        "brier": 0.05, "crps": 0.04, "pit": 0.62, "abs_err_market": 0.02, "abs_err_naive": 0.1,
    }, {
        "series_ticker": "KXCPI", "event_ticker": "KXCPI-27JAN",
        "close": CLOSE + timedelta(days=90), "release_date": None,
        "reference_period": date(2027, 1, 1), "match_method": "reference_period",
        "first_print": None, "first_print_source": "alfred", "settled_value": None,
        "mean_t1h": None, "sd_t1h": None, "surprise": None, "surprise_sd": None,
        "reaction_date": None, "reaction_prev_date": None,
        "dgs2_change_bp": None, "dgs10_change_bp": None,
        "in_50": None, "in_90": None, "surprise_rank_pct": None, "series_n": None,
        "series_hit_50": None, "series_hit_90": None, "yield_n": None,
        "dgs2_bp_per_sd": None, "dgs10_bp_per_sd": None, "dgs2_corr": None, "dgs10_corr": None,
        "brier": None, "crps": None, "pit": None, "abs_err_market": None, "abs_err_naive": None,
    }], schema_overrides={"close": TS}).write_parquet(paths.gold / "event_surprise.parquet")

    keys = {"series_ticker": "KXCPI", "event_ticker": "KXCPI-26SEP"}
    hours = [168, 1, 0]
    anchor = CLOSE.replace(minute=0)
    pl.DataFrame([
        {**keys, "ts": anchor - timedelta(hours=h), "hours_before_close": h, "n_bins": 3,
         "mean": 0.5, "sd": 0.1, "p05": 0.35, "p25": 0.45, "p50": 0.5, "p75": 0.55, "p95": 0.65}
        for h in hours
    ], schema_overrides={"ts": TS}).write_parquet(paths.gold / "implied_stats.parquet")
    pl.DataFrame([
        {**keys, "ts": anchor - timedelta(hours=h), "hours_before_close": h,
         "bin_lower": lo, "bin_upper": hi, "prob": p}
        for h in hours for lo, hi, p in ((None, 0.4, 0.2), (0.4, 0.5, 0.5), (0.5, None, 0.3))
    ], schema_overrides={"ts": TS}).write_parquet(paths.gold / "implied_bins.parquet")
    pl.DataFrame([
        {**keys, "ts": anchor - timedelta(hours=h), "hours_before_close": h,
         "ticker": f"T{k}", "floor_strike": k, "price": raw, "weight": 100.0, "price_age_h": 0,
         "survival": fit}
        for h in hours for k, raw, fit in ((0.4, 0.79, 0.8), (0.5, 0.31, 0.3))
    ], schema_overrides={"ts": TS}).write_parquet(paths.gold / "implied_survival.parquet")
    return paths


def test_build_web_writes_manifest_and_event_files(tmp_path):
    paths = _gold(tmp_path)

    assert build_web(paths) == {"events": 1}  # the event with no snapshots yet is left out

    manifest = json.loads((paths.web / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["data_through"] == "2026-10-14T12:00:00Z"
    (entry,) = manifest["events"]
    assert entry["title"] == "CPI, September 2026"
    assert entry["file"] == "events/kxcpi-26sep.json"
    assert entry["n_snapshots"] == 3
    assert entry["strikes"] == 2  # strikes priced at T-1h

    event = json.loads((paths.web / entry["file"]).read_text(encoding="utf-8"))
    assert [s["h"] for s in event["snapshots"]] == [168, 1, 0]  # earliest hour first
    first = event["snapshots"][0]
    assert first["ts"] == "2026-10-07T12:00:00Z"
    assert first["bins"] == [[None, 0.4, 0.2], [0.4, 0.5, 0.5], [0.5, None, 0.3]]
    assert first["survival"] == [[0.4, 0.79, 0.8], [0.5, 0.31, 0.3]]
    assert sum(p for _, _, p in first["bins"]) == pytest.approx(1.0)
    assert event["surprise_sd"] == 0.235772  # rounded to 6 digits
    assert (event["unit"], event["resolution"]) == ("% m/m", 0.1)
    assert event["reaction"] == {
        "date": "2026-10-14", "prev_date": "2026-10-13", "dgs2_bp": 6.0, "dgs10_bp": 4.0,
    }
    insight = event["insight"]
    assert (insight["in_50"], insight["series_n"], insight["yield_n"]) == (True, 41, 39)
    assert insight["dgs2_bp_per_sd"] == 2.123457  # rounded to 6 digits


def test_build_web_is_byte_identical_when_rebuilt(tmp_path):
    paths = _gold(tmp_path)
    build_web(paths)
    first = {p.name: p.read_bytes() for p in paths.web.rglob("*.json")}
    build_web(paths)
    second = {p.name: p.read_bytes() for p in paths.web.rglob("*.json")}
    assert first == second


SUMMARY_EVENT_SCHEMA = {
    "series_ticker": pl.String, "event_ticker": pl.String, "reference_period": pl.Date,
    "close": TS, "surprise_sd": pl.Float64, "dgs2_change_bp": pl.Float64,
    "dgs10_change_bp": pl.Float64, "in_50": pl.Boolean, "in_90": pl.Boolean, "series_n": pl.UInt32,
    "series_hit_50": pl.Float64, "series_hit_90": pl.Float64, "yield_n": pl.UInt32,
    "dgs2_bp_per_sd": pl.Float64, "dgs10_bp_per_sd": pl.Float64, "dgs2_corr": pl.Float64,
    "dgs10_corr": pl.Float64, "brier": pl.Float64, "crps": pl.Float64, "pit": pl.Float64,
    "abs_err_market": pl.Float64, "abs_err_naive": pl.Float64,
}


def test_summary_has_one_row_per_series_and_one_point_per_published_event():
    series = (40, 0.5, 0.9, 38, 6.0, 4.0, 0.55, 0.48)
    events = pl.DataFrame([
        ("KXCPI", "KXCPI-26AUG", date(2026, 8, 1), CLOSE - timedelta(days=33), 1.5, 9.0, 5.0,
         False, True, *series, 0.06, 0.05, 0.95, 0.2, None),
        ("KXCPI", "KXCPI-26SEP", date(2026, 9, 1), CLOSE, -0.5, -2.0, -1.0, True, True, *series,
         0.04, 0.03, 0.31, 0.1, 0.2),
        ("KXCPI", "KXCPI-26OCT", date(2026, 10, 1), CLOSE + timedelta(days=30), None, None, None,
         None, None, *series, None, None, None, None, None),  # upcoming: no point
    ], schema=SUMMARY_EVENT_SCHEMA, orient="row")

    out = summary_payload(events)

    (cpi,) = out["series"]
    assert cpi["series"] == "KXCPI" and cpi["label"] == "CPI"
    assert (cpi["n"], cpi["hit_50"], cpi["hit_90"]) == (40, 0.5, 0.9)
    assert cpi["mean_abs_sd"] == 1.0  # mean of 1.5 and 0.5
    scores = cpi["scores"]
    assert (scores["n"], scores["brier"], scores["crps"]) == (2, 0.05, 0.04)
    # only KXCPI-26SEP has a previous print, so both errors come from it alone
    assert (scores["mae_market"], scores["mae_naive"], scores["skill"]) == (0.1, 0.2, 0.5)
    assert scores["pit_hist"] == [0, 0, 0, 1, 0, 0, 0, 0, 0, 1]
    assert [p["id"] for p in out["points"]] == ["kxcpi-26aug", "kxcpi-26sep"]
    first = out["points"][0]
    assert first == {
        "id": "kxcpi-26aug", "series": "KXCPI", "title": "CPI, August 2026", "surprise_sd": 1.5,
        "dgs2_bp": 9.0, "dgs10_bp": 5.0, "in_50": False, "in_90": True,
    }


def test_build_web_writes_the_summary(tmp_path):
    paths = _gold(tmp_path)
    build_web(paths)
    summary = json.loads((paths.web / "summary.json").read_text(encoding="utf-8"))
    assert summary["schema_version"] == 1
    assert [p["id"] for p in summary["points"]] == ["kxcpi-26sep"]


def test_revisions_summarise_settled_periods_and_list_every_period():
    d = date
    now = d(2026, 10, 14)
    rev = pl.DataFrame(
        [
            ("KXCPI", d(2020, 1, 1), d(2020, 2, 13), 0.2, d(2020, 3, 11), 0.2, 0.3, now),
            ("KXCPI", d(2020, 2, 1), d(2020, 3, 11), 0.1, d(2020, 4, 10), 0.1, 0.0, now),
            ("KXCPI", d(2020, 3, 1), d(2020, 4, 10), 0.4, d(2020, 5, 12), 0.4, 0.4, now),
            # too young to be settled: listed, but left out of the statistics
            ("KXCPI", d(2026, 8, 1), d(2026, 9, 11), 0.3, None, None, 0.9, now),
        ],
        schema=REVISION_SCHEMA, orient="row",
    )

    out = revisions_payload(rev)

    assert out["settled_months"] == 24
    (cpi,) = out["series"]
    assert (cpi["series"], cpi["label"], cpi["n"]) == ("KXCPI", "CPI", 3)
    assert cpi["latest_vintage"] == "2026-10-14"
    assert cpi["mean_revision"] == pytest.approx(0.0)
    assert cpi["mean_abs_revision"] == pytest.approx(0.066667)
    assert cpi["mean_abs_next"] == pytest.approx(0.0)
    assert (cpi["share_up"], cpi["share_down"]) == (pytest.approx(1 / 3), pytest.approx(1 / 3))
    assert cpi["mean_abs_first"] == pytest.approx(0.233333)
    assert [b["period"] for b in cpi["biggest"]] == ["2020-01-01", "2020-02-01", "2020-03-01"]
    assert [p["settled"] for p in cpi["points"]] == [True, True, True, False]
    assert cpi["points"][3] == {
        "period": "2026-08-01", "first": 0.3, "next": None, "latest": 0.9, "settled": False,
    }
