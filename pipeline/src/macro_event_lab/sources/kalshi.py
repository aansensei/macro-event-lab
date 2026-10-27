"""Kalshi public market data (no API key needed for these REST endpoints).

Settled markets older than Kalshi's "historical cutoff" move to /historical/* endpoints,
so we ask for the cutoff first and route each market to the right endpoint.
Docs: https://docs.kalshi.com/getting_started/historical_data
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from macro_event_lab.http import RateLimitedClient
from macro_event_lab.raw_store import iter_manifest, save_raw

PAGE_LIMIT = 1000
PERIOD_MINUTES = 60  # allowed: 1, 60, 1440
CHUNK_SECONDS = 10 * 24 * 3600  # request candles in 10-day windows
CANDLE_KINDS = {"kalshi.candles", "kalshi.historical_candles"}


def _save(client_resp, raw_dir: Path, kind: str, params: dict[str, Any], meta: dict[str, Any]):
    return save_raw(
        raw_dir, kind, str(client_resp.url.copy_with(query=None)), params, client_resp.content, meta
    )


def get_cutoff(client: RateLimitedClient, raw_dir: Path) -> dict[str, Any]:
    response = client.get("/historical/cutoff")
    _save(response, raw_dir, "kalshi.cutoff", {}, {})
    return response.json()


def iter_markets(
    client: RateLimitedClient, raw_dir: Path, series_ticker: str, historical: bool
) -> Iterator[dict[str, Any]]:
    """All markets of a series.

    The live endpoint returns every status; the historical one returns old settled markets.
    """
    path = "/historical/markets" if historical else "/markets"
    kind = "kalshi.historical_markets" if historical else "kalshi.markets"
    cursor = ""
    while True:
        params: dict[str, Any] = {"series_ticker": series_ticker, "limit": PAGE_LIMIT}
        if cursor:
            params["cursor"] = cursor
        response = client.get(path, params=params)
        _save(response, raw_dir, kind, params, {"series_ticker": series_ticker})
        payload = response.json()
        yield from payload.get("markets", [])
        cursor = payload.get("cursor") or ""
        if not cursor:
            return


def parse_ts(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def time_chunks(start_ts: int, end_ts: int, size: int = CHUNK_SECONDS) -> list[tuple[int, int]]:
    """Split [start_ts, end_ts] into consecutive windows that cover it with no gaps."""
    if end_ts < start_ts:
        return []
    chunks = []
    lo = start_ts
    while lo <= end_ts:
        hi = min(lo + size - 1, end_ts)
        chunks.append((lo, hi))
        lo = hi + 1
    return chunks


def fetched_candle_windows(raw_dir: Path) -> set[tuple[str, int, int, int]]:
    """(ticker, start_ts, end_ts, period) of candle windows already in the raw store.

    Only windows whose last period had closed when they were fetched count: those can no
    longer change, so a re-run (for example after a crash) can skip them safely.
    """
    done = set()
    for record in iter_manifest(raw_dir):
        if record.kind not in CANDLE_KINDS:
            continue
        p = record.params
        fetched = datetime.fromisoformat(record.fetched_at_utc).timestamp()
        if p["end_ts"] + p["period_interval"] * 60 <= fetched:
            done.add((record.meta["ticker"], p["start_ts"], p["end_ts"], p["period_interval"]))
    return done


def ingest_candles(
    client: RateLimitedClient,
    raw_dir: Path,
    series_ticker: str,
    market: dict[str, Any],
    historical: bool,
    period_minutes: int = PERIOD_MINUTES,
    skip: set[tuple[str, int, int, int]] | None = None,
) -> int:
    """Download candlesticks for one market from open_time to close_time. Returns request count.

    Windows listed in `skip` (see `fetched_candle_windows`) are not requested again.
    """
    ticker = market["ticker"]
    opened, closed = parse_ts(market.get("open_time")), parse_ts(market.get("close_time"))
    if opened is None or closed is None:
        return 0
    closed = min(closed, datetime.now(UTC))
    if historical:
        path, kind = f"/historical/markets/{ticker}/candlesticks", "kalshi.historical_candles"
    else:
        path, kind = f"/series/{series_ticker}/markets/{ticker}/candlesticks", "kalshi.candles"

    requests = 0
    for lo, hi in time_chunks(int(opened.timestamp()), int(closed.timestamp())):
        if skip and (ticker, lo, hi, period_minutes) in skip:
            continue
        params = {"start_ts": lo, "end_ts": hi, "period_interval": period_minutes}
        response = client.get(path, params=params)
        _save(response, raw_dir, kind, params, {"series_ticker": series_ticker, "ticker": ticker})
        requests += 1
    return requests


# everything below parses saved responses and runs only in `build`, never at ingest time

# Last ticker segment of an "above k" market: T0.4, T-0.1, TN0.1 (N also means minus), T256000
TICKER_STRIKE = re.compile(r"-T(N?)(-?\d+(?:\.\d+)?)$")
TITLE_STRIKE = re.compile(r"(?:more than|above)\s+(-?[\d,]*\.?\d+)", re.IGNORECASE)


def strike_from_ticker(ticker: str, title: str | None) -> float | None:
    """Threshold k of a legacy "above k" market whose API record has no strike fields.

    Older CPI-, FED- and GDP- markets (and two early 2025 events) carry k only in the ticker.
    The value is accepted only when the title states the same number ("more than 0.4%",
    "above -100000 jobs"), so an unfamiliar ticker shape yields None instead of a guess.
    """
    m = TICKER_STRIKE.search(ticker)
    t = TITLE_STRIKE.search(title or "")
    if not m or not t:
        return None
    value = float(m.group(2)) * (-1 if m.group(1) else 1)
    return value if value == float(t.group(1).replace(",", "")) else None

def _num(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _ohlc(obj: dict[str, Any] | None, field: str) -> float | None:
    """Live candles use `close_dollars`; historical candles use `close`."""
    if not obj:
        return None
    return _num(obj.get(f"{field}_dollars", obj.get(field)))


def parse_markets(series_ticker: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for m in payload.get("markets", []):
        strike_type = m.get("strike_type")
        floor_strike, cap_strike = _num(m.get("floor_strike")), _num(m.get("cap_strike"))
        has_strike = floor_strike is not None or cap_strike is not None
        strike_source = "api" if strike_type and has_strike else None
        if strike_source is None:
            k = strike_from_ticker(m["ticker"], m.get("title"))
            if k is not None:
                strike_type, floor_strike, cap_strike, strike_source = "greater", k, None, "ticker"
        rows.append(
            {
                "ticker": m["ticker"],
                "event_ticker": m.get("event_ticker"),
                "series_ticker": series_ticker,
                "title": m.get("title"),
                "strike_type": strike_type,
                "floor_strike": floor_strike,
                "cap_strike": cap_strike,
                "strike_source": strike_source,
                "status": m.get("status"),
                # Kalshi sends "" for both until the market settles
                "result": m.get("result") or None,
                "expiration_value": m.get("expiration_value") or None,
                "open_time": parse_ts(m.get("open_time")),
                "close_time": parse_ts(m.get("close_time")),
                "settlement_ts": parse_ts(m.get("settlement_ts")),
            }
        )
    return rows


def parse_candles(payload: dict[str, Any]) -> list[dict[str, Any]]:
    ticker = payload.get("ticker")
    rows = []
    for c in payload.get("candlesticks", []):
        price = c.get("price") or {}
        rows.append(
            {
                "ticker": ticker,
                "end_period_ts": datetime.fromtimestamp(int(c["end_period_ts"]), UTC),
                "yes_bid_close": _ohlc(c.get("yes_bid"), "close"),
                "yes_ask_close": _ohlc(c.get("yes_ask"), "close"),
                "price_close": _ohlc(price, "close"),
                "price_mean": _ohlc(price, "mean"),
                "volume": _num(c.get("volume_fp", c.get("volume"))),
                "open_interest": _num(c.get("open_interest_fp", c.get("open_interest"))),
            }
        )
    return rows
