import numpy as np
import pytest
from test_independent_models import make_synthetic_panel

from macro_event_lab.arena import contestants
from macro_event_lab.arena.export import _contributions


@pytest.mark.parametrize("seed", [101, 202, 505, 606])
@pytest.mark.parametrize("name", ["ridge", "lasso"])
def test_parts_sum_to_unchanged_prediction_and_missing_feature_is_zero(seed, name):
    panel = make_synthetic_panel(seed, 60, near_collinear=seed == 505, with_outlier=seed == 606)
    point = getattr(contestants, name + "_forecast")(*panel)
    decomposed = getattr(contestants, name + "_parts")(*panel)
    forecast, baseline, terms = decomposed
    assert forecast == point
    assert baseline + sum(terms) == pytest.approx(point, abs=1e-9)
    assert terms[2] == pytest.approx(0, abs=1e-12)
    assert np.isfinite(terms).all()
    assert baseline == pytest.approx(np.mean(panel[1]))


def test_export_rejects_inconsistent_or_nonfinite_parts():
    assert _contributions("gdp", {}) == {}
    terms = [0.0] * len(contestants.monthly_feature_names("payrolls"))
    exported = _contributions("payrolls", {"ridge": (1.0, 1.0, terms)})["ridge"]
    assert len(exported["terms"]) == len(terms)
    assert exported["terms"][0]["feature"] == "LAG_1"
    with pytest.raises(ValueError, match="do not sum"):
        _contributions("gdp", {"ridge": (5, 0, [0] * len(contestants.FEATURES))})
    with pytest.raises(ValueError, match="do not sum"):
        _contributions("gdp", {"ridge": (5, float("nan"), [0] * len(contestants.FEATURES))})
    with pytest.raises(ValueError):
        _contributions("gdp", {"ridge": (0, 0, [0])})


def test_short_panels_have_no_parts():
    panel = make_synthetic_panel(101, 19)
    assert contestants.ridge_parts(*panel) is None
    assert contestants.lasso_parts(*panel) is None
