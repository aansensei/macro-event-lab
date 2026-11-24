import type { Contestant, LeakageRow } from "../data/arena";

export function LeakageTable({ contestants, leakage }: { contestants: Contestant[]; leakage: LeakageRow[] }) {
  const labels = { published: "Published training cutoff", weights_release_date: "First public weights date", none: "No cutoff" };
  return <details className="arena-leakage" id="arena-leakage">
    <summary>Could a model have seen the answer?</summary>
    <p>A model's training data can include historical economic series. A cutoff separates earlier and later forecast origins; it does not prove that an evaluation is free of overlap.</p>
    <p className="muted">Error figures are withheld because the audit record does not specify their target and measurement units. The counts below are supplied audit totals, not counts for the currently selected target.</p>
    {!leakage.length ? <p>No leakage audit records are available yet.</p>
      : <table className="arena-table arena-audit-table" role="table"><caption>Reported cutoff metadata and observation counts</caption>
        <thead role="rowgroup"><tr role="row">{["Contestant", "Cutoff rule", "Cutoff date", "Before or on cutoff", "After cutoff"].map((label) => <th key={label} scope="col" role="columnheader">{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{leakage.map((row) => <tr key={row.contestant} role="row">
          <th scope="row" role="rowheader">{contestants.find((contestant) => contestant.id === row.contestant)?.label}</th>
          <td data-label="Cutoff rule" role="cell">{labels[row.cutoff_rule]}</td>
          <td data-label="Cutoff date" role="cell">{row.cutoff ?? "Not applicable"}</td>
          <td data-label="Before or on cutoff" role="cell">{row.n_before}</td>
          <td data-label="After cutoff" role="cell">{row.n_after}</td>
        </tr>)}</tbody>
      </table>}
  </details>;
}
