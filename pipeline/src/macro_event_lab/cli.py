"""Command line: `python -m macro_event_lab <command>` (or `mel <command>`)."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime

from macro_event_lab import config
from macro_event_lab.build import build_silver
from macro_event_lab.http import RateLimitedClient
from macro_event_lab.sources import alfred, kalshi


def cmd_ingest_alfred(args: argparse.Namespace) -> None:
    paths = config.get_paths()
    key = config.fred_api_key()
    series = args.series or list(config.ALFRED_SERIES)
    with RateLimitedClient(config.FRED_BASE_URL, config.FRED_RPS) as client:
        for series_id in series:
            rows = alfred.ingest_series(client, paths.raw, series_id, key)
            print(f"ALFRED {series_id}: {rows:,} vintage rows")


def cmd_ingest_kalshi(args: argparse.Namespace) -> None:
    paths = config.get_paths()
    series = args.series or list(config.KALSHI_SERIES)
    since = datetime.fromisoformat(args.since).replace(tzinfo=UTC) if args.since else None
    with RateLimitedClient(config.KALSHI_BASE_URL, config.KALSHI_RPS) as client:
        cutoff = kalshi.parse_ts(kalshi.get_cutoff(client, paths.raw).get("market_settled_ts"))
        already_fetched = kalshi.fetched_candle_windows(paths.raw)
        for series_ticker in series:
            live = list(kalshi.iter_markets(client, paths.raw, series_ticker, historical=False))
            old = list(kalshi.iter_markets(client, paths.raw, series_ticker, historical=True))
            live_tickers = {m["ticker"] for m in live}
            # (market, is_historical): archived markets must use the /historical candle endpoint
            markets = [(m, False) for m in live] + [
                (m, True) for m in old if m["ticker"] not in live_tickers
            ]
            if since:
                markets = [
                    (m, h) for m, h in markets
                    if (kalshi.parse_ts(m.get("close_time")) or since) >= since
                ]
            if args.max_markets:
                markets = markets[: args.max_markets]
            requests = 0
            for market, archived in markets:
                settled = kalshi.parse_ts(market.get("settlement_ts"))
                historical = archived or bool(cutoff and settled and settled < cutoff)
                requests += kalshi.ingest_candles(
                    client, paths.raw, series_ticker, market, historical, args.period,
                    skip=already_fetched,
                )
            print(f"Kalshi {series_ticker}: {len(markets)} markets, {requests} candle requests")


def cmd_build(_: argparse.Namespace) -> None:
    counts = build_silver(config.get_paths())
    for table, n in counts.items():
        print(f"silver/{table}.parquet: {n:,} rows")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="mel", description="Macro Event Lab pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="download raw data")
    ingest_sub = ingest.add_subparsers(dest="source", required=True)

    p_alfred = ingest_sub.add_parser("alfred", help="all vintages of macro series from ALFRED")
    p_alfred.add_argument("--series", nargs="*", help="series ids (default: config.ALFRED_SERIES)")
    p_alfred.set_defaults(func=cmd_ingest_alfred)

    p_kalshi = ingest_sub.add_parser("kalshi", help="markets + candlesticks from Kalshi")
    p_kalshi.add_argument("--series", nargs="*", help="series tickers (default: KALSHI_SERIES)")
    p_kalshi.add_argument("--since", help="only markets closing on/after YYYY-MM-DD")
    p_kalshi.add_argument("--max-markets", type=int, help="cap per series (for quick tests)")
    p_kalshi.add_argument(
        "--period", type=int, default=kalshi.PERIOD_MINUTES, choices=[1, 60, 1440],
        help="candle length in minutes",
    )
    p_kalshi.set_defaults(func=cmd_ingest_kalshi)

    p_build = sub.add_parser("build", help="rebuild silver Parquet tables from raw")
    p_build.set_defaults(func=cmd_build)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
