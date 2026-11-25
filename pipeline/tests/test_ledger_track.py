from __future__ import annotations

import json
from datetime import date

import polars as pl
import pytest
from hypothesis import given
from hypothesis import strategies as st

from macro_event_lab import cli, ledger
from macro_event_lab.arena.targets import TARGET_SCHEMA
from macro_event_lab.ledger_track import model_order, score_ledger


def record(model="naive", period="2026-10-01", forecast=2.0, recorded="2026-11-01"):
    return {"target": "cpi", "reference_period": period, "model_id": model,
            "point_forecast": forecast, "as_of": recorded,
            "recorded_at_utc": recorded + "T00:00:00Z", "sequence": 1}


def test_scores_pending_late_shared_periods_and_unknown_order():
    rows = [record(), record("ridge", forecast=1), record("ar", forecast=3),
            record("unknown", forecast=1), record("naive", recorded="2026-11-10"),
            record("ridge", period="2026-11-01"),
            record("ar", period="2026-09-01", forecast=4)]
    prints = [{"target": "cpi", "reference_period": p, "release_date": "2026-11-10",
               "first_print": actual} for p, actual in [("2026-10-01", 1), ("2026-09-01", 2)]]
    result = score_ledger(rows, prints)
    assert result["ledger_rows"] == 7
    assert result["late"] == 1
    assert result["pending"] == [{"target": "cpi", "reference_period": "2026-11-01", "rows": 1}]
    ar = next(r for r in result["summary"] if r["model_id"] == "ar")
    # Both errors are 2, so MAE and RMSE are 2. The only paired error exceeds naive's 1.
    assert ar == {"target": "cpi", "model_id": "ar", "n": 2, "mae": 2, "rmse": 2,
                  "beat_naive": 0}
    assert [r["model_id"] for r in result["summary"]] == ["naive", "ar", "ridge", "unknown"]
    assert result["summary"][2]["beat_naive"] == 1
    assert model_order("unknown") > model_order("spf")
    assert score_ledger(rows, prints) == result


def test_ties_do_not_beat_naive_and_missing_baseline_is_null():
    prints = [{"target": "cpi", "reference_period": "2026-10-01",
               "release_date": "2026-11-10", "first_print": 1.0}]
    assert score_ledger([record("ar")], prints)["summary"][0]["beat_naive"] is None
    assert score_ledger([record(), record("ar")], prints)["summary"][1]["beat_naive"] == 0
    assert score_ledger([], prints)["scored"] == []
    with pytest.raises(ValueError, match="finite"):
        score_ledger([record(forecast=float("nan"))], prints)


@given(st.lists(st.floats(min_value=-100, max_value=100, allow_nan=False), max_size=25))
def test_counts_and_strict_before_release(values):
    rows = [record(forecast=v) for v in values]
    prints = [{"target": "cpi", "reference_period": "2026-10-01",
               "release_date": "2026-11-10", "first_print": 1.0}]
    result = score_ledger(rows, prints)
    assert result["ledger_rows"] == len(rows) == len(result["scored"])
    assert all(r["recorded_at_utc"][:10] < r["release_date"] for r in result["scored"])
    assert result == score_ledger(rows, prints)


def test_cli_writes_track_and_refuses_tampered_chain(tmp_path, monkeypatch, capsys):
    from macro_event_lab import config
    from macro_event_lab.arena import targets

    monkeypatch.setenv("MEL_DATA_DIR", str(tmp_path))
    silver = config.get_paths().silver
    silver.mkdir(parents=True, exist_ok=True)
    pl.DataFrame({"placeholder": [1]}).write_parquet(silver / "alfred_observations.parquet")
    monkeypatch.setattr(targets, "first_print_targets", lambda _: pl.DataFrame([
        {"target": "cpi", "period": date(2026, 10, 1), "release_date": date(2026, 11, 10),
         "first_print": 1.0}], schema=TARGET_SCHEMA))
    path, out = tmp_path / "ledger.jsonl", tmp_path / "out" / "ledger_track.json"
    rows = ledger.build_rows([record()], ledger.GENESIS_HASH, 0)
    ledger.append_rows(path, rows)
    cli.main(["ledger-track", "--file", str(path), "--out", str(out)])
    assert "1 scored, 0 pending periods, 0 late" in capsys.readouterr().out
    assert json.loads(out.read_text())["summary"][0]["mae"] == 1
    assert out.read_bytes().endswith(b"\n")
    rows[0]["point_forecast"] = 50
    path.write_text(json.dumps(rows[0]) + "\n")
    refused = tmp_path / "refused.json"
    with pytest.raises(SystemExit) as exc:
        cli.main(["ledger-track", "--file", str(path), "--out", str(refused)])
    assert exc.value.code == 1
    assert not refused.exists()
