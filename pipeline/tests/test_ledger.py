from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from macro_event_lab import cli, ledger


def _sample_fields(count: int = 10) -> list[dict[str, Any]]:
    targets = ("gdp", "cpi", "payrolls")
    models = ("naive", "ar", "ridge")
    items: list[dict[str, Any]] = []
    for index in range(count):
        items.append(
            {
                "target": targets[index % len(targets)],
                "reference_period": f"2026-{(index % 9) + 1:02d}-01",
                "model_id": models[index % len(models)],
                "point_forecast": round(1.25 + 0.1 * index, 4),
                "as_of": "2026-11-24",
                "recorded_at_utc": f"2026-11-24T0{index}:00:00Z",
            }
        )
    return items


def _sample_chain(count: int = 10) -> list[dict[str, Any]]:
    return ledger.build_rows(_sample_fields(count), ledger.GENESIS_HASH, 0)


def test_canonical_json_ignores_key_order_and_the_entry_hash() -> None:
    row = _sample_chain()[0]
    reordered = {key: row[key] for key in reversed(list(row.keys()))}
    reordered["entry_hash"] = "f" * 64
    assert ledger.canonical_json(reordered) == ledger.canonical_json(row)
    assert ledger.entry_hash(reordered) == row["entry_hash"]


def test_a_valid_chain_has_no_problems() -> None:
    rows = _sample_chain()
    assert len(rows) == 10
    assert list(rows[0].keys()) == list(ledger.FIELDS)
    assert ledger.verify_ledger(rows) == []


def test_genesis_row_must_start_the_chain() -> None:
    bad_sequence = _sample_chain()
    bad_sequence[0]["sequence"] = 2
    assert {"index": 0, "code": "GENESIS"} in ledger.verify_ledger(bad_sequence)

    bad_prev_hash = _sample_chain()
    bad_prev_hash[0]["prev_hash"] = "a" * 64
    assert {"index": 0, "code": "GENESIS"} in ledger.verify_ledger(bad_prev_hash)


def test_changing_one_number_is_caught_at_that_row() -> None:
    rows = _sample_chain()
    rows[4]["point_forecast"] = rows[4]["point_forecast"] + 1.0
    assert ledger.verify_ledger(rows) == [{"index": 4, "code": "HASH_MISMATCH"}]


def test_swapping_two_rows_is_caught() -> None:
    rows = _sample_chain()
    rows[6], rows[7] = rows[7], rows[6]
    problems = ledger.verify_ledger(rows)
    codes = {problem["code"] for problem in problems}
    assert "SEQUENCE_BREAK" in codes or "PREV_HASH_MISMATCH" in codes


def test_dropping_a_row_is_caught() -> None:
    rows = _sample_chain()
    del rows[3]
    problems = ledger.verify_ledger(rows)
    assert {"index": 3, "code": "SEQUENCE_BREAK"} in problems
    assert {"index": 3, "code": "PREV_HASH_MISMATCH"} in problems


def test_an_earlier_timestamp_is_caught() -> None:
    rows = _sample_chain()
    rows[5]["recorded_at_utc"] = "2026-11-24T03:00:00Z"
    rows[5]["entry_hash"] = ledger.entry_hash(rows[5])
    for index in range(6, len(rows)):
        rows[index]["prev_hash"] = rows[index - 1]["entry_hash"]
        rows[index]["entry_hash"] = ledger.entry_hash(rows[index])
    assert ledger.verify_ledger(rows) == [{"index": 5, "code": "TIME_ORDER"}]


def test_entries_from_arena_skips_missing_values_and_known_keys() -> None:
    arena = {
        "live": [
            {
                "target": "gdp",
                "period": "2026-07-01",
                "as_of": "2026-11-24",
                "values": {"spf": 2.46244, "ar": 2.32411, "naive": None},
            },
            {
                "target": "cpi",
                "period": "2026-10-01",
                "as_of": "2026-11-24",
                "values": {"naive": 0.6, "ar": 0.38219},
            },
        ]
    }
    existing = {("gdp", "2026-07-01", "ar")}
    entries = ledger.entries_from_arena(arena, "2026-11-24T06:00:00Z", existing)
    assert entries == [
        {
            "target": "cpi",
            "reference_period": "2026-10-01",
            "model_id": "ar",
            "point_forecast": 0.3822,
            "as_of": "2026-11-24",
            "recorded_at_utc": "2026-11-24T06:00:00Z",
        },
        {
            "target": "cpi",
            "reference_period": "2026-10-01",
            "model_id": "naive",
            "point_forecast": 0.6,
            "as_of": "2026-11-24",
            "recorded_at_utc": "2026-11-24T06:00:00Z",
        },
        {
            "target": "gdp",
            "reference_period": "2026-07-01",
            "model_id": "spf",
            "point_forecast": 2.4624,
            "as_of": "2026-11-24",
            "recorded_at_utc": "2026-11-24T06:00:00Z",
        },
    ]


def test_append_then_read_round_trips_and_continues_the_chain(tmp_path: Path) -> None:
    ledger_path = tmp_path / "nested" / "forecast_ledger.jsonl"
    assert ledger.read_ledger(ledger_path) == []

    first_batch = ledger.build_rows(_sample_fields(3), ledger.GENESIS_HASH, 0)
    ledger.append_rows(ledger_path, first_batch)
    loaded = ledger.read_ledger(ledger_path)
    assert len(loaded) == 3

    second_fields = _sample_fields(5)[3:]
    second_batch = ledger.build_rows(
        second_fields, loaded[-1]["entry_hash"], loaded[-1]["sequence"]
    )
    ledger.append_rows(ledger_path, second_batch)
    all_rows = ledger.read_ledger(ledger_path)
    assert len(all_rows) == 5
    assert ledger.verify_ledger(all_rows) == []


def test_cli_verify_ledger_exit_codes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    ledger_path = tmp_path / "forecast_ledger.jsonl"
    rows = _sample_chain()
    ledger.append_rows(ledger_path, rows)

    cli.main(["verify-ledger", "--file", str(ledger_path)])
    captured = capsys.readouterr()
    assert captured.out.strip() == "OK: 10 rows"

    rows[4]["point_forecast"] = rows[4]["point_forecast"] + 2.0
    tampered_path = tmp_path / "tampered.jsonl"
    ledger.append_rows(tampered_path, rows)

    with pytest.raises(SystemExit) as exc_info:
        cli.main(["verify-ledger", "--file", str(tampered_path)])
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "PROBLEM row 4: HASH_MISMATCH" in captured.out


def test_summarize_ledger_reports_size_newest_row_and_chain_verdict() -> None:
    rows = _sample_chain(10)
    summary = ledger.summarize_ledger(rows)
    assert summary == {
        "schema_version": 1,
        "rows": 10,
        "first_recorded_at_utc": rows[0]["recorded_at_utc"],
        "last_recorded_at_utc": rows[-1]["recorded_at_utc"],
        "last_as_of": "2026-11-24",
        "head_hash": rows[-1]["entry_hash"],
        "chain_ok": True,
        "problems": 0,
    }


def test_summarize_ledger_flags_a_tampered_row() -> None:
    rows = _sample_chain(10)
    rows[4]["point_forecast"] = rows[4]["point_forecast"] + 2.0
    summary = ledger.summarize_ledger(rows)
    assert summary["chain_ok"] is False
    assert summary["problems"] >= 1


def test_summarize_ledger_of_an_empty_ledger_has_no_dates_and_a_clean_chain() -> None:
    summary = ledger.summarize_ledger([])
    assert summary["rows"] == 0
    assert summary["last_recorded_at_utc"] is None
    assert summary["head_hash"] is None
    assert summary["chain_ok"] is True


def test_cli_ledger_summary_writes_the_json_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    import json

    ledger_path = tmp_path / "ledger.jsonl"
    ledger.append_rows(ledger_path, _sample_chain(10))
    out = tmp_path / "out" / "ledger.json"
    cli.main(["ledger-summary", "--file", str(ledger_path), "--out", str(out)])
    written = json.loads(out.read_text(encoding="utf-8"))
    assert written["rows"] == 10
    assert written["chain_ok"] is True
    assert "10 rows" in capsys.readouterr().out
