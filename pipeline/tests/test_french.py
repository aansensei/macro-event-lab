import io
import zipfile
from datetime import date

from macro_event_lab.sources.french import parse_first_table, read_zip_csv

# the shape of 12_Industry_Portfolios_Daily.csv: notes, the value-weighted table, then another
INDUSTRIES = """This file was created using the 202609 CRSP database.
It contains value- and equal-weighted returns for 12 industry portfolios.

Missing data are indicated by -99.99 or -999.


  Average Value Weighted Returns -- Daily
         ,NoDur,BusEq,Money
20260929,   0.31,  -1.20, -99.99
20260930,  -0.58,   0.50,  -0.93


  Average Equal Weighted Returns -- Daily
         ,NoDur,BusEq,Money
20260929,   9.99,   9.99,   9.99
"""

# the shape of F-F_Research_Data_Factors_daily.csv: notes, one table, a copyright line
FACTORS = """This file was created by using the 202609 CRSP database.

,Mkt-RF,SMB,HML,RF
20260930,   -0.26,    0.32,   -0.88,    0.01

Copyright 2026 Eugene F. Fama and Kenneth R. French
"""


def test_reads_only_the_first_table_in_percent():
    rows = parse_first_table(INDUSTRIES)
    assert len(rows) == 6  # the equal-weighted table is ignored
    assert rows[0] == {"portfolio": "NoDur", "date": date(2026, 9, 29), "ret_pct": 0.31}
    assert {r["portfolio"] for r in rows} == {"NoDur", "BusEq", "Money"}


def test_missing_codes_become_none():
    money = [r for r in parse_first_table(INDUSTRIES) if r["portfolio"] == "Money"]
    assert [r["ret_pct"] for r in money] == [None, -0.93]


def test_reads_the_factor_table_and_stops_at_the_copyright():
    rows = {r["portfolio"]: r["ret_pct"] for r in parse_first_table(FACTORS)}
    assert rows == {"Mkt-RF": -0.26, "SMB": 0.32, "HML": -0.88, "RF": 0.01}


def test_reads_the_single_csv_inside_the_zip():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        z.writestr("F-F_Research_Data_Factors_daily.csv", FACTORS.encode("latin-1"))
    assert read_zip_csv(buffer.getvalue()) == FACTORS
