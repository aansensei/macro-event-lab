import json
from datetime import UTC, date, datetime, timedelta

import polars as pl
import pytest

from macro_event_lab.config import Paths
from macro_event_lab.web_export import build_web, event_id, event_title

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
    }, {
        "series_ticker": "KXCPI", "event_ticker": "KXCPI-27JAN",
        "close": CLOSE + timedelta(days=90), "release_date": None,
        "reference_period": date(2027, 1, 1), "match_method": "reference_period",
        "first_print": None, "first_print_source": "alfred", "settled_value": None,
        "mean_t1h": None, "sd_t1h": None, "surprise": None, "surprise_sd": None,
        "reaction_date": None, "reaction_prev_date": None,
        "dgs2_change_bp": None, "dgs10_change_bp": None,
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


def test_build_web_is_byte_identical_when_rebuilt(tmp_path):
    paths = _gold(tmp_path)
    build_web(paths)
    first = {p.name: p.read_bytes() for p in paths.web.rglob("*.json")}
    build_web(paths)
    second = {p.name: p.read_bytes() for p in paths.web.rglob("*.json")}
    assert first == second
