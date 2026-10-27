"""Command line: `python -m macro_event_lab <command>` (or `mel <command>`)."""

from __future__ import annotations

import argparse
from datetime import UTC, datetime

import polars as pl

from macro_event_lab import config, pit, quality
from macro_event_lab.build import build_silver
from macro_event_lab.gold import build_gold
from macro_event_lab.http import RateLimitedClient
from macro_event_lab.sources import alfred, kalshi, releases
from macro_event_lab.web_export import build_web


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


def cmd_ingest_releases(_: argparse.Namespace) -> None:
    paths = config.get_paths()
    key = config.fred_api_key()
    with RateLimitedClient(config.FRED_BASE_URL, config.FRED_RPS) as client:
        for name, release in config.RELEASES.items():
            if release.fred_release_id is None:
                continue  # FOMC dates come from seeds/fomc_meetings.csv
            n = releases.ingest_release_dates(
                client, paths.raw, name, release.fred_release_id, key
            )
            print(f"FRED release {name} (id {release.fred_release_id}): {n:,} dates")


def cmd_asof(args: argparse.Namespace) -> None:
    ts = datetime.fromisoformat(args.timestamp.replace("Z", "+00:00"))
    if ts.tzinfo is None:
        raise SystemExit("Give a time zone, e.g. 2026-10-14T08:29-04:00 or 2026-10-14T12:29Z")
    snapshot = pit.as_of(pit.connect(config.get_paths().silver), ts)
    print(f"As of {ts.isoformat()}")
    latest = (
        snapshot.alfred.sort("observation_date")
        .group_by("series_id", maintain_order=True)
        .last()
        .sort("series_id")
    )
    print("\nALFRED: latest observation public at that moment")
    for row in latest.iter_rows(named=True):
        print(
            f"  {row['series_id']:<13} {row['observation_date']}  value={row['value']}"
            f"  vintage={row['realtime_start']}  known_from={row['known_from']}"
            f" ({row['known_from_source']})"
        )
    print(f"\nKalshi: {snapshot.kalshi.height} markets open")
    for row in snapshot.kalshi.group_by("series_ticker").len().sort("series_ticker").iter_rows():
        print(f"  {row[0]:<11} {row[1]} markets")


def cmd_check(args: argparse.Namespace) -> None:
    results = quality.run_checks(pit.connect(config.get_paths().silver))
    for r in results:
        found = "" if r.problems is None else f" ({r.problems.height:,} rows)"
        excused = f", {r.excused.height:,} known anomaly rows excused" if r.excused.height else ""
        print(f"{r.status:<4}  {r.check.name}{found}{excused}: {r.check.description}")
        if r.problems is not None and not r.problems.is_empty():
            with pl.Config(tbl_hide_dataframe_shape=True, tbl_width_chars=160):
                print(r.problems.head(args.show))
    if any(r.status == "FAIL" for r in results):
        raise SystemExit(1)


def cmd_build(_: argparse.Namespace) -> None:
    paths = config.get_paths()
    for table, n in build_silver(paths).items():
        print(f"silver/{table}.parquet: {n:,} rows")
    for table, n in build_gold(paths).items():
        print(f"gold/{table}.parquet: {n:,} rows")
    print(f"web/manifest.json: {build_web(paths)['events']:,} events")


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

    p_releases = ingest_sub.add_parser("releases", help="CPI, jobs and GDP release dates (FRED)")
    p_releases.set_defaults(func=cmd_ingest_releases)

    p_build = sub.add_parser("build", help="rebuild silver and gold Parquet tables from raw")
    p_build.set_defaults(func=cmd_build)

    p_check = sub.add_parser("check", help="data quality checks on silver (exit 1 on errors)")
    p_check.add_argument("--show", type=int, default=5, help="problem rows to print per check")
    p_check.set_defaults(func=cmd_check)

    p_asof = sub.add_parser("asof", help="print what was public at a moment (point in time)")
    p_asof.add_argument("timestamp", help="ISO time with zone, e.g. 2026-10-14T12:29Z")
    p_asof.set_defaults(func=cmd_asof)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
