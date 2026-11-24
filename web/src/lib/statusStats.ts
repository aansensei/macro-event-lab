import type { QualityStatus, StatusCheck, StatusSource } from "../data/status";

export type CheckSelection = "all" | QualityStatus;

export function sourceAgeDays(source: StatusSource, informationDate: string): number {
  return (Date.parse(informationDate) - Date.parse(source.latest_vintage_date)) / 86_400_000;
}

export function checkCounts(checks: StatusCheck[]): Record<CheckSelection, number> {
  return checks.reduce((counts, check) => {
    counts[check.status] += 1;
    return counts;
  }, { all: checks.length, pass: 0, warn: 0, fail: 0 });
}

export function visibleChecks(checks: StatusCheck[], selection: CheckSelection): StatusCheck[] {
  return selection === "all" ? checks : checks.filter((check) => check.status === selection);
}

export function checkTitle(name: string): string {
  const titles: Record<string, string> = {
    duplicates_alfred_observations: "Unique economic observations",
    duplicates_release_calendar: "Unique release dates",
    missing_observations: "Observation history gaps",
    spf_forecasts: "Survey records and publication dates",
  };
  return titles[name] ?? name.replaceAll("_", " ");
}
