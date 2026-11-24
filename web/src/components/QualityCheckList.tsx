import type { StatusCheck } from "../data/status";
import { checkTitle, visibleChecks, type CheckSelection } from "../lib/statusStats";
import { StatusBadge } from "./StatusBadge";

export function QualityCheckList({ checks, selection }: { checks: StatusCheck[]; selection: CheckSelection }) {
  const visible = visibleChecks(checks, selection);
  return <>
    <p className="t-micro muted" role="status" aria-live="polite">Showing {visible.length} quality {visible.length === 1 ? "check" : "checks"}.</p>
    {!visible.length ? <p className="state-banner">{checks.length ? "No checks match this filter." : "No quality check records are available yet."}</p>
      : <table className="status-table status-check-table" role="table"><caption className="sr-only">Executed quality checks</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Check</th><th scope="col" role="columnheader">Status</th><th scope="col" role="columnheader">Issues found</th><th scope="col" role="columnheader">Description</th></tr></thead>
        <tbody role="rowgroup">{visible.map((check) => <tr key={check.name} role="row">
          <th scope="row" role="rowheader">{checkTitle(check.name)}</th>
          <td data-label="Status" role="cell"><StatusBadge label={check.status.charAt(0).toUpperCase() + check.status.slice(1)} tone={check.status} /></td>
          <td data-label="Issues found" role="cell">{check.problems.toLocaleString("en-US")}</td>
          <td data-label="Description" role="cell">{check.description}</td>
        </tr>)}</tbody>
      </table>}
  </>;
}
