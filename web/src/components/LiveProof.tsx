import { useMemo } from "react";

import type { BriefingRelease } from "../data/briefing";
import type { LedgerSummary } from "../data/ledger";
import { liveProofItems } from "../lib/liveProof";
import type { RefreshStatus } from "../lib/refreshLine";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./Icon";

interface LiveProofProps {
  ledger: LedgerSummary | null;
  status: RefreshStatus | null;
  releases: BriefingRelease[];
  nowIso?: string;
}

// a strip of three facts a visitor can check: the forecast ledger, the last data refresh and the next release
export function LiveProof({ ledger, status, releases, nowIso }: LiveProofProps) {
  const now = useMemo(() => nowIso ?? new Date().toISOString(), [nowIso]);
  const items = liveProofItems(ledger, status, releases, now);
  if (items.length === 0) return null;
  return (
    <section className="live-proof" aria-labelledby="live-proof-title">
      <h2 className="t-h2" id="live-proof-title">Live proof</h2>
      <ul className="live-proof-list">
        {items.map((item) => {
          const body = (
            <>
              <span className="live-proof-title">
                <Icon name={item.ok ? "circle-check" : "circle-alert"} size={14} />
                {item.title}
              </span>
              <span className="live-proof-value num">{item.value}</span>
              <span className="live-proof-detail">{item.detail}</span>
              <Icon name={item.external ? "arrow-up-right" : "arrow-right"} size={18} className="live-proof-arrow" />
            </>
          );
          return (
            <li key={item.id}>
              {item.external
                ? <ExternalLink className="live-proof-card" href={item.href}>{body}</ExternalLink>
                : <a className="live-proof-card" href={item.href}>{body}</a>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
