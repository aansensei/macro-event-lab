import type { Contestant, TargetId } from "./arena";
import { arrayValue, dateValue, fetchPublicJson, objectValue, textValue } from "./publicData";

export const BRIEFING_NOT_BUILT = "The release briefing has not been built yet.";

export interface BriefingForecast {
  id: string;
  label: string;
  kind: Contestant["kind"];
  value: number;
}

export interface BriefingRelease {
  target: TargetId;
  label: string;
  unit: string;
  period: string;
  release_date: string | null;
  release_ts_utc: string | null;
  forecasts: BriefingForecast[];
  last_first_print: number | null;
}

export interface Briefing {
  schema_version: 1;
  information_date: string;
  releases: BriefingRelease[];
}

function nullableNumber(value: unknown, where: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}: invalid numeric value.`);
  }
  return value;
}

function targetId(value: unknown): TargetId {
  if (value !== "gdp" && value !== "cpi" && value !== "payrolls") {
    throw new Error("Release briefing refers to an unknown target.");
  }
  return value;
}

function contestantKind(value: unknown): Contestant["kind"] {
  if (value !== "baseline" && value !== "classical" && value !== "foundation" && value !== "human") {
    throw new Error("Release briefing refers to an unknown contestant kind.");
  }
  return value;
}

export function parseBriefing(value: unknown): Briefing {
  const root = objectValue(value, "Briefing");
  if (root.schema_version !== 1) {
    throw new Error("Unsupported briefing data version. This page reads version 1.");
  }
  const informationDate = dateValue(root.information_date, "Information date");
  const releases = arrayValue(root.releases, "Releases").map((raw): BriefingRelease => {
    const entry = objectValue(raw, "Release entry");
    const period = dateValue(entry.period, "Reference period");
    const releaseDate = entry.release_date === null ? null : dateValue(entry.release_date, "Release date");
    let releaseTsUtc: string | null = null;
    if (entry.release_ts_utc !== null) {
      const ts = textValue(entry.release_ts_utc, "Release timestamp");
      if (!Number.isFinite(Date.parse(ts))) {
        throw new Error("Release timestamp: expected an ISO UTC timestamp.");
      }
      releaseTsUtc = ts;
    }
    const forecasts = arrayValue(entry.forecasts, "Forecasts").map((rawForecast): BriefingForecast => {
      const item = objectValue(rawForecast, "Forecast");
      if (typeof item.value !== "number" || !Number.isFinite(item.value)) {
        throw new Error("Forecast value: invalid numeric value.");
      }
      return {
        id: textValue(item.id, "Forecast contestant ID"),
        label: textValue(item.label, "Forecast contestant label"),
        kind: contestantKind(item.kind),
        value: item.value,
      };
    });
    return {
      target: targetId(entry.target),
      label: textValue(entry.label, "Target label"),
      unit: textValue(entry.unit, "Target unit"),
      period,
      release_date: releaseDate,
      release_ts_utc: releaseTsUtc,
      forecasts,
      last_first_print: nullableNumber(entry.last_first_print, "Last first print"),
    };
  });
  return {
    schema_version: 1,
    information_date: informationDate,
    releases,
  };
}

export async function loadBriefing(fetchImpl: typeof fetch = fetch): Promise<Briefing> {
  return parseBriefing(await fetchPublicJson("briefing", BRIEFING_NOT_BUILT, fetchImpl));
}
