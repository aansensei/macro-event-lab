import type { StatusData } from "./status";

export const statusFixture: StatusData = {
  schema_version: 1, generated_at: "2026-11-20T14:30:00Z", information_date: "2026-11-20",
  sources: [
    { id: "alfred", label: "Fixture economic source", latest_vintage_date: "2026-11-15",
      series_count: 2, rows: 12, max_age_days: 7, is_fresh: true },
    { id: "spf", label: "Fixture survey source", latest_vintage_date: "2026-08-15",
      series_count: 1, rows: 4, max_age_days: 120, is_fresh: true },
  ],
  checks: [
    { name: "duplicates_alfred_observations", status: "pass", problems: 0, description: "Fixture observations are unique." },
    { name: "duplicates_release_calendar", status: "pass", problems: 0, description: "Fixture release dates are unique." },
    { name: "missing_observations", status: "warn", problems: 1, description: "Fixture history has one gap." },
    { name: "spf_forecasts", status: "fail", problems: 2, description: "Fixture survey records need inspection." },
  ],
};
