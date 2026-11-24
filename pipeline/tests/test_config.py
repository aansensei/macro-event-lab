from __future__ import annotations

import ast
from pathlib import Path

from macro_event_lab import config


def test_alfred_identifiers_are_unique_before_dictionary_evaluation() -> None:
    tree = ast.parse(Path(config.__file__).read_text(encoding="utf-8"))
    assignment = next(
        node for node in tree.body
        if isinstance(node, ast.AnnAssign)
        and isinstance(node.target, ast.Name) and node.target.id == "ALFRED_SERIES"
    )
    assert isinstance(assignment.value, ast.Dict)
    identifiers = [ast.literal_eval(key) for key in assignment.value.keys]
    assert len(identifiers) == len(set(identifiers))
    assert all(identifier.isupper() and identifier.isalnum() for identifier in identifiers)
    assert all(description.strip() for description in config.ALFRED_SERIES.values())


def test_alfred_series_preserve_existing_ids_and_the_complete_indicator_panel() -> None:
    existing = {
        "CPIAUCSL", "CPILFESL", "CUSR0000SAH1", "PAYEMS", "UNRATE", "GDPC1",
        "INDPRO", "PCEC96", "RRSFS", "HOUST",
    }
    indicators = {
        "AHETPI", "AMTMNO", "AWHMAN", "BOPGSTB", "BUSINV", "BUSLOANS", "CE16OV",
        "CIVPART", "CMRMTSPL", "CPIAUCSL", "CPILFESL", "DGORDER", "DSPIC96",
        "FEDFUNDS", "GS10", "IPMAN", "ISRATIO", "M2SL", "PCEPI", "PCEPILFE",
        "PERMIT", "RSAFS", "TCU", "TOTALSL", "TTLCONS", "W875RX1",
    }
    assert len(indicators - existing) == 24
    assert set(config.ALFRED_SERIES) == existing | indicators
    assert len(config.ALFRED_SERIES) == 34
