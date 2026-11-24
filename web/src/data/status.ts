import { arrayValue, countValue, dateValue, fetchPublicJson, objectValue, textValue, uniqueValues } from "./publicData";

export type QualityStatus = "pass" | "warn" | "fail";
export interface StatusSource {
  id: "alfred" | "spf";
  label: string;
  latest_vintage_date: string;
  series_count: number;
  rows: number;
  max_age_days: number;
  is_fresh: boolean;
}
export interface StatusCheck {
  name: string;
  status: QualityStatus;
  problems: number;
  description: string;
}
export interface StatusData {
  schema_version: 1;
  generated_at: string;
  information_date: string;
  sources: StatusSource[];
  checks: StatusCheck[];
}

const CHECK_NAMES = ["duplicates_alfred_observations", "duplicates_release_calendar", "missing_observations", "spf_forecasts"];

export function parseStatus(value: unknown): StatusData {
  const root = objectValue(value, "Status");
  if (root.schema_version !== 1) throw new Error("Unsupported status data version. This page reads version 1.");
  const informationDate = dateValue(root.information_date, "Information date");
  const generatedAt = textValue(root.generated_at, "Build time");
  dateValue(generatedAt.slice(0, 10), "Build date");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(generatedAt)
    || !Number.isFinite(Date.parse(generatedAt))
    || new Date(generatedAt).toISOString() !== generatedAt.replace("Z", ".000Z")) {
    throw new Error("Build time: expected a real UTC timestamp.");
  }
  const sources = arrayValue(root.sources, "Sources").map((value): StatusSource => {
    const source = objectValue(value, "Source");
    if (source.id !== "alfred" && source.id !== "spf") throw new Error("Unknown data source.");
    const latest = dateValue(source.latest_vintage_date, "Latest data update");
    const threshold = countValue(source.max_age_days, "Freshness threshold");
    const age = (Date.parse(informationDate) - Date.parse(latest)) / 86_400_000;
    if (typeof source.is_fresh !== "boolean" || source.is_fresh !== (age >= 0 && age <= threshold)) {
      throw new Error("Source freshness does not match its dates and threshold.");
    }
    return {
      id: source.id, label: textValue(source.label, "Source label"), latest_vintage_date: latest,
      series_count: countValue(source.series_count, "Series count"), rows: countValue(source.rows, "Record count"),
      max_age_days: threshold, is_fresh: source.is_fresh,
    };
  });
  const checks = arrayValue(root.checks, "Quality checks").map((value): StatusCheck => {
    const check = objectValue(value, "Quality check");
    const name = textValue(check.name, "Check name");
    if (!CHECK_NAMES.includes(name)) throw new Error("Unknown public quality check.");
    if (check.status !== "pass" && check.status !== "warn" && check.status !== "fail") {
      throw new Error("Unknown quality check outcome.");
    }
    return { name, status: check.status, problems: countValue(check.problems, "Issues found"),
      description: textValue(check.description, "Check description") };
  });
  uniqueValues(sources.map((source) => source.id), "Sources");
  uniqueValues(checks.map((check) => check.name), "Quality checks");
  return { schema_version: 1, generated_at: generatedAt, information_date: informationDate, sources, checks };
}

export async function loadStatus(fetchImpl: typeof fetch = fetch): Promise<StatusData> {
  return parseStatus(await fetchPublicJson("status", "The status snapshot has not been built yet.", fetchImpl));
}
