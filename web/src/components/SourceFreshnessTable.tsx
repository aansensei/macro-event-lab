import type { StatusSource } from "../data/status";
import { sourceAgeDays } from "../lib/statusStats";
import { StatusBadge } from "./StatusBadge";

export function SourceFreshnessTable({ sources, informationDate }: { sources: StatusSource[]; informationDate: string }) {
  return <section className="status-section" aria-labelledby="status-sources">
    <h2 id="status-sources" className="t-h3">Data sources</h2>
    <p className="muted">Freshness measures the latest data update against this build's information cutoff. It does not establish complete history.</p>
    {!sources.length ? <p className="state-banner">No source freshness records are available yet.</p>
      : <table className="status-table" role="table"><caption className="sr-only">Source freshness and record counts</caption>
        <thead role="rowgroup"><tr role="row">{["Source", "Status", "Latest data update", "Age and threshold", "Tracked series", "Total records"].map((label) => <th scope="col" role="columnheader" key={label}>{label}</th>)}</tr></thead>
        <tbody role="rowgroup">{sources.map((source) => {
          const age = sourceAgeDays(source, informationDate);
          return <tr key={source.id} role="row">
            <th scope="row" role="rowheader">{source.label}</th>
            <td data-label="Status" role="cell"><StatusBadge label={age < 0 ? "Date anomaly" : source.is_fresh ? "Fresh" : "Stale"} tone={source.is_fresh ? "pass" : "warn"} /></td>
            <td data-label="Latest data update" role="cell"><time dateTime={source.latest_vintage_date}>{source.latest_vintage_date}</time></td>
            <td data-label="Age and threshold" role="cell">{age < 0 ? `${-age} days after cutoff` : `${age} ${age === 1 ? "day" : "days"}`}<small>Threshold: {source.max_age_days} days</small></td>
            <td data-label="Tracked series" role="cell">{source.series_count.toLocaleString("en-US")}</td>
            <td data-label="Total records" role="cell">{source.rows.toLocaleString("en-US")}</td>
          </tr>;
        })}</tbody>
      </table>}
  </section>;
}
