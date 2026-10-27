# Macro Event Lab

What did markets expect before each CPI, jobs report and Fed decision, and how did bonds and stocks react when the number came out?

Macro Event Lab is an automated, point-in-time data pipeline that:

1. Collects prediction-market prices (Kalshi) for U.S. macro releases.
2. Recovers the market-implied probability distribution of each release.
3. Compares it with the number actually published at the time (ALFRED vintages, not today's revised data).
4. Measures how Treasury yields and sector stocks reacted to the surprise.
5. Serves everything on a fully interactive website (coming in week 4).

**Status:** week 1, ingestion. See [ROADMAP.md](ROADMAP.md).

## Repo layout

| Folder | What | Stack |
| --- | --- | --- |
| [`pipeline/`](pipeline) | Ingestion, point-in-time tables, analytics, tests | Python, Polars, DuckDB, Parquet |
| [`web/`](web) | Fully interactive website (week 4) | React, TypeScript, DuckDB-WASM, Plotly |
| [`api/`](api) | MCP server for as-of-date questions (Spring 2027) | FastAPI, MCP |
| `data/` | raw / silver / gold tables, shared by pipeline and web (not committed) | |

## Why point-in-time matters

Official numbers get revised. Backtesting with today's revised values leaks information that nobody had on release day (look-ahead bias). Every row here has two clocks: what period a value describes (`observation_date`) and when the market could first know it (`realtime_start`, later an exact release timestamp).

## Architecture

```
Kalshi REST ─┐                    ┌─ silver/kalshi_markets.parquet
ALFRED API ──┼─► raw (bronze) ──► ├─ silver/kalshi_candles.parquet ──► gold (week 3+) ──► web (DuckDB-WASM)
             │   gzipped JSON,    └─ silver/alfred_observations.parquet
             │   content-addressed
             └── _manifest.jsonl (what, when, from where; API keys redacted)
```

- **Raw first:** every API response is saved before parsing, named by its SHA-256, so re-runs never duplicate files.
- **Rebuildable:** `build` re-parses all raw files from scratch; it is deterministic and idempotent.
- **Polite ingestion:** rate-limited client with retries on 429/5xx.

## Data sources

| Source | What | Access |
| --- | --- | --- |
| [Kalshi API](https://docs.kalshi.com) | Markets and hourly candles for CPI (`KXCPI`), payrolls (`KXPAYROLLS`), Fed rate (`KXFED`), GDP (`KXGDP`) | Public REST, no key |
| [ALFRED](https://alfred.stlouisfed.org) | Every vintage of CPI, core CPI, CPI shelter, payrolls, unemployment, real GDP | Free FRED API key |

Raw data stays local (not committed). Only derived tables will be published.

## Quickstart (Windows PowerShell)

Run everything from the repo root:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".\pipeline[dev]"
copy .env.example .env          # then paste your FRED_API_KEY into .env

python -m macro_event_lab ingest alfred
python -m macro_event_lab ingest kalshi --max-markets 20   # small test first
python -m macro_event_lab build
pytest pipeline
```

macOS / Linux: `source .venv/bin/activate` and `cp .env.example .env`.

## Commands

| Command | Does |
| --- | --- |
| `ingest alfred [--series ...]` | Download all vintages of the ALFRED series |
| `ingest kalshi [--series ...] [--since YYYY-MM-DD] [--max-markets N] [--period 1/60/1440]` | Download markets and candlesticks |
| `ingest releases` | Download CPI, jobs and GDP release dates (FRED); FOMC dates come from `pipeline/src/macro_event_lab/seeds/` |
| `build` | Rebuild silver Parquet tables from raw |
| `check [--show N]` | Data quality checks on silver (duplicates, bid above ask, prices outside [0, 1], missing months, markets without a strike); exits 1 on errors |
| `asof 2026-10-14T12:31Z` | Print what was public at that moment: newest ALFRED vintages and open Kalshi markets |

## License

MIT
