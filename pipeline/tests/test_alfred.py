from datetime import date

from macro_event_lab.sources.alfred import parse_observations

PAYLOAD = {
    "count": 3,
    "observations": [
        # First release of March 2020 payrolls, later revised
        {"realtime_start": "2020-04-03", "realtime_end": "2020-05-07",
         "date": "2020-03-01", "value": "151786"},
        {"realtime_start": "2020-05-08", "realtime_end": "9999-12-31",
         "date": "2020-03-01", "value": "151095"},
        {"realtime_start": "2020-04-03", "realtime_end": "9999-12-31",
         "date": "2019-01-01", "value": "."},
    ],
}


def test_parses_vintages():
    rows = parse_observations("PAYEMS", PAYLOAD)
    assert len(rows) == 3
    first = rows[0]
    assert first["series_id"] == "PAYEMS"
    assert first["observation_date"] == date(2020, 3, 1)
    assert first["realtime_start"] == date(2020, 4, 3)
    assert first["realtime_end"] == date(2020, 5, 7)
    assert first["value"] == 151786.0


def test_current_vintage_has_open_end():
    assert parse_observations("PAYEMS", PAYLOAD)[1]["realtime_end"] is None


def test_missing_value_is_none():
    assert parse_observations("PAYEMS", PAYLOAD)[2]["value"] is None
