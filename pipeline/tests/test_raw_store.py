from datetime import UTC, datetime

from macro_event_lab.raw_store import iter_manifest, load_raw, save_raw

NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


def test_same_body_is_stored_once(tmp_path):
    body = b'{"observations": []}'
    a = save_raw(tmp_path, "alfred.observations", "u", {}, body, now=NOW)
    b = save_raw(tmp_path, "alfred.observations", "u", {}, body, now=NOW)
    assert a.path == b.path
    assert len(list((tmp_path / "alfred").rglob("*.json.gz"))) == 1
    assert len(list(iter_manifest(tmp_path))) == 2  # both fetches are logged


def test_api_key_never_written(tmp_path):
    save_raw(tmp_path, "alfred.observations", "u", {"api_key": "SECRET", "x": 1}, b"{}", now=NOW)
    manifest_text = (tmp_path / "_manifest.jsonl").read_text()
    assert "SECRET" not in manifest_text
    assert '"x": 1' in manifest_text


def test_roundtrip(tmp_path):
    rec = save_raw(tmp_path, "kalshi.markets", "u", {}, b'{"markets": [1, 2]}', {"k": "v"}, NOW)
    assert load_raw(tmp_path, rec) == {"markets": [1, 2]}
    assert next(iter_manifest(tmp_path)).meta == {"k": "v"}
