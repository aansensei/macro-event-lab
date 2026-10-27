# Seeds

Small hand-checked reference tables for sources that publish no API.

## fomc_meetings.csv

FOMC meetings 2021 to 2027 from the Federal Reserve's calendar page,
https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm (retrieved 2026-10-26).

- `statement_date`: for held meetings, the date in the statement's URL (`monetaryYYYYMMDDa.htm`); for future meetings, the last day of the meeting.
- `meeting_type`: `scheduled_meeting` or `notation_vote` (no meeting; not used for the release calendar because no release time is published for it).
- `has_sep`: the meeting comes with a Summary of Economic Projections (asterisk on the Fed page).
- `status`: `held` (statement published), `scheduled`, or `tentative` (the Fed marks next year's dates tentative until confirmed at the preceding meeting).

Statements of scheduled meetings are released at 2:00 p.m. Eastern (checked on the September 16, 2026 statement). Re-check the page after each meeting and when the next year's calendar is confirmed.
