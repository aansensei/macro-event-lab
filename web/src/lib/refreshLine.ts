export type RefreshStatus = {
  generated_at: string;
  information_date: string;
  run_url?: string | null;
  sources: { is_fresh: boolean | null }[];
};

export type RefreshLineState = "current" | "late" | "missing";

export interface RefreshLineResult {
  state: RefreshLineState;
  text: string;
  runUrl: string | null;
}

const LATE_AFTER_MS = 26 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatUtcMinute(iso: string): string | null {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp);
  const yyyy = date.getUTCFullYear();
  const mm = pad2(date.getUTCMonth() + 1);
  const dd = pad2(date.getUTCDate());
  const hh = pad2(date.getUTCHours());
  const min = pad2(date.getUTCMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// formats the data refresh text, freshness state and optional build log link
export function refreshLine(status: RefreshStatus | null, nowIso: string): RefreshLineResult {
  if (status === null) {
    return { state: "missing", text: "Refresh time unavailable", runUrl: null };
  }
  const refreshedAt = formatUtcMinute(status.generated_at);
  if (refreshedAt === null) {
    return { state: "missing", text: "Refresh time unavailable", runUrl: null };
  }
  const ageMs = Date.parse(nowIso) - Date.parse(status.generated_at);
  const hasStaleSource = status.sources.some((source) => source.is_fresh === false);
  const state: RefreshLineState = ageMs > LATE_AFTER_MS || hasStaleSource ? "late" : "current";
  const rawUrl = status.run_url;
  const runUrl = typeof rawUrl === "string" && rawUrl.length > 0 && rawUrl.startsWith("https://")
    ? rawUrl
    : null;
  return {
    state,
    text: `Data refreshed ${refreshedAt} UTC. Newest source data: ${status.information_date}. Next rebuild about 14:30 UTC.`,
    runUrl,
  };
}
