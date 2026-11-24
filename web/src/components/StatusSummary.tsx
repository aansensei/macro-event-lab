import type { StatusCheck, StatusSource } from "../data/status";
import { checkCounts } from "../lib/statusStats";

export function StatusSummary({ sources, checks }: { sources: StatusSource[]; checks: StatusCheck[] }) {
  const counts = checkCounts(checks);
  return <dl className="status-summary" aria-label="Data status summary">
    <div><dt>Data sources fresh</dt><dd>{sources.filter((source) => source.is_fresh).length} of {sources.length}</dd></div>
    <div><dt>Checks passed</dt><dd>{counts.pass} of {counts.all}</dd></div>
    <div><dt>Checks needing attention</dt><dd>{counts.warn + counts.fail}</dd></div>
  </dl>;
}
