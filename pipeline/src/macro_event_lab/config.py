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
    # monthly activity indicators that feed the GDP nowcast
    "INDPRO": "Industrial production index, SA",
    "PCEC96": "Real personal consumption expenditures, SA",
    "RRSFS": "Advance real retail and food services sales, SA",
    "HOUST": "Housing starts, SA annual rate",
}

# Kenneth R. French Data Library: daily industry and market returns, rebuilt monthly.
FRENCH_BASE_URL = "https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp"
FRENCH_FILES: dict[str, str] = {
    "industries_12": "12_Industry_Portfolios_Daily_CSV.zip",
    "factors": "F-F_Research_Data_Factors_daily_CSV.zip",
}
FRENCH_RPS = 0.5

# Daily market series from FRED's current vintage (closes are not revised in practice).
YIELD_SERIES: dict[str, str] = {
    "DGS2": "2-year Treasury constant maturity yield, daily",
    "DGS10": "10-year Treasury constant maturity yield, daily",
}



@dataclass(frozen=True)
class Release:
    fred_release_id: int | None  # None: dates come from a seed file instead of FRED
    local_time: str  # official release time, America/New_York
    alfred_series: tuple[str, ...] = ()  # ALFRED series whose vintages this release publishes


# FRED release ids checked on fred.stlouisfed.org/release?rid=... (Oct 2026). Release times
# from the BLS schedule pages (CPI, Employment Situation: 08:30), the BEA schedule (GDP:
# 8:30 AM ET) and FOMC statements ("For release at 2:00 p.m. EDT").
RELEASE_TZ = "America/New_York"
RELEASES: dict[str, Release] = {
    "cpi": Release(10, "08:30", ("CPIAUCSL", "CPILFESL", "CUSR0000SAH1")),
    "employment_situation": Release(50, "08:30", ("PAYEMS", "UNRATE")),
    "gdp": Release(53, "08:30", ("GDPC1",)),
    "fomc": Release(None, "14:00"),
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
    def web(self) -> Path:
        return self.root / "web"

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
