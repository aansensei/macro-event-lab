import type { BriefingRelease } from "../data/briefing";
import type { LedgerSummary } from "../data/ledger";
import { daysUntil, formatReleaseDate, periodTitle } from "./briefingWords";
import { formatUtcMinute, refreshLine, type RefreshStatus } from "./refreshLine";
import { pageSearch } from "./url";

export const LEDGER_FILE_URL = "https://github.com/aansensei/macro-event-lab/blob/main/ledger/forecast_ledger.jsonl";

export interface ProofItem {
  id: "ledger" | "refresh" | "release";
  title: string;
  value: string;
  detail: string;
  href: string;
  external: boolean;
  ok: boolean;
}

function ledgerItem(ledger: LedgerSummary): ProofItem {
  const count = `${ledger.rows} ${ledger.rows === 1 ? "forecast" : "forecasts"}`;
  let detail = "Nothing has been recorded yet.";
  if (!ledger.chain_ok) {
    detail = "The hash chain check failed at the last build. Open the file to inspect it.";
  } else if (ledger.last_recorded_at_utc !== null) {
    detail = `Each row is hashed with the one before it, and the chain passed its check. Newest record: ${ledger.last_recorded_at_utc.slice(0, 10)}.`;
  }
  return {
    id: "ledger", title: "Forecasts on record", value: count, detail,
    href: LEDGER_FILE_URL, external: true, ok: ledger.chain_ok,
  };
}

function refreshItem(status: RefreshStatus, nowIso: string): ProofItem | null {
  const refreshedAt = formatUtcMinute(status.generated_at);
  if (refreshedAt === null) return null;
  const state = refreshLine(status, nowIso).state;
  return {
    id: "refresh", title: "Data refreshed", value: `${refreshedAt} UTC`,
    detail: state === "late"
      ? "The daily rebuild is overdue or a source is out of date. Data status has the details."
      : `Newest source data: ${status.information_date}. The site is rebuilt every day at about 14:30 UTC.`,
    href: pageSearch("status"), external: false, ok: state === "current",
  };
}

function nextRelease(releases: BriefingRelease[], todayIso: string): BriefingRelease | null {
  let best: BriefingRelease | null = null;
  for (const release of releases) {
    if (release.release_date === null || release.release_date < todayIso) continue;
    if (best === null || release.release_date < (best.release_date as string)) best = release;
  }
  return best;
}

function releaseItem(releases: BriefingRelease[], todayIso: string): ProofItem | null {
  const release = nextRelease(releases, todayIso);
  if (release === null || release.release_date === null) return null;
  const days = daysUntil(release.release_date, todayIso);
  const when = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return {
    id: "release", title: "Next release",
    value: `${release.label}, ${periodTitle(release.target, release.period)}`,
    detail: `${when}, ${formatReleaseDate(release.release_date)}.`,
    href: pageSearch("briefing"), external: false, ok: true,
  };
}

// the proof items that can be built from the data at hand, in a fixed order; a missing source drops its item
export function liveProofItems(
  ledger: LedgerSummary | null,
  status: RefreshStatus | null,
  releases: BriefingRelease[],
  nowIso: string,
): ProofItem[] {
  const items: (ProofItem | null)[] = [
    ledger === null ? null : ledgerItem(ledger),
    status === null ? null : refreshItem(status, nowIso),
    releaseItem(releases, nowIso.slice(0, 10)),
  ];
  return items.filter((item): item is ProofItem => item !== null);
}
