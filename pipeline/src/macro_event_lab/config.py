"""Paths, API endpoints and the series this project tracks."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# config.py sits at pipeline/src/macro_event_lab/, so the repo root is three levels up.
REPO_ROOT = Path(__file__).resolve().parents[3]

load_dotenv(REPO_ROOT / ".env")

KALSHI_BASE_URL = "https://external-api.kalshi.com/trade-api/v2"
FRED_BASE_URL = "https://api.stlouisfed.org/fred"

# Kalshi series verified via GET /series/{ticker} (Oct 2026).
# Older contracts may live under legacy tickers (e.g. "CPI", "FED") [VERIFY before backfilling].
KALSHI_SERIES: dict[str, str] = {
    "KXCPI": "CPI (monthly, BLS)",
    "KXPAYROLLS": "Nonfarm payrolls (monthly, BLS)",
    "KXFED": "Fed funds rate (FOMC decisions)",
    "KXGDP": "U.S. GDP growth (quarterly, BEA)",
}

# ALFRED series: every vintage (each time a number was published or revised).
ALFRED_SERIES: dict[str, str] = {
    "CPIAUCSL": "CPI, all items, SA",
    "CPILFESL": "Core CPI (less food and energy), SA",
    "CUSR0000SAH1": "CPI shelter, SA",
    "PAYEMS": "Total nonfarm payrolls, SA",
    "UNRATE": "Unemployment rate",
    "GDPC1": "Real GDP",
}

# Requests per second. FRED documents 120 requests/minute; Kalshi documents 20/s for its
# Basic authenticated tier, unauthenticated limits are not published, so stay well below.
FRED_RPS = 1.5
KALSHI_RPS = 5.0


@dataclass(frozen=True)
class Paths:
    root: Path

    @property
    def raw(self) -> Path:
        return self.root / "raw"

    @property
    def silver(self) -> Path:
        return self.root / "silver"

    @property
    def gold(self) -> Path:
        return self.root / "gold"

    @property
    def manifest(self) -> Path:
        return self.raw / "_manifest.jsonl"


def get_paths() -> Paths:
    return Paths(Path(os.getenv("MEL_DATA_DIR", REPO_ROOT / "data")))


def fred_api_key() -> str:
    key = os.getenv("FRED_API_KEY", "").strip()
    if not key:
        raise SystemExit(
            "FRED_API_KEY is missing. Copy .env.example to .env and paste your free key from "
            "https://fred.stlouisfed.org/docs/api/api_key.html"
        )
    return key
