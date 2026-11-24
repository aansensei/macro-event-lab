from __future__ import annotations

import hashlib
from pathlib import Path

PROTOCOL = Path(__file__).resolve().parents[1] / "EVAL_PROTOCOL.md"
MARKER = "<!-- roster-changes-below -->"
# editing the frozen text on purpose means updating this value in the same change
FROZEN_SHA256 = "b29e7704c06166bf53c193ec53e602ad4914d2c55ac57a2d993af5f4d494910f"
CONTESTANT_IDS = (
    "naive", "ar", "ridge", "factor_ridge", "lasso", "foundation_a", "foundation_b", "spf",
)


def _text() -> str:
    return PROTOCOL.read_text(encoding="utf-8").replace("\r\n", "\n")


def test_frozen_part_of_the_protocol_is_unchanged() -> None:
    frozen = _text().split(MARKER)[0]
    assert hashlib.sha256(frozen.encode("utf-8")).hexdigest() == FROZEN_SHA256


def test_roster_changes_are_recorded_below_the_marker() -> None:
    text = _text()
    assert text.count(MARKER) == 1
    assert text.split(MARKER)[1].lstrip().startswith("## Roster changes")


def test_protocol_names_every_contestant_and_target() -> None:
    text = _text()
    for identifier in (*CONTESTANT_IDS, "gdp", "cpi", "payrolls"):
        assert f"`{identifier}`" in text


def test_protocol_uses_no_dashes_as_punctuation() -> None:
    assert not any(character in _text() for character in "—–")
