import type { ArenaTarget, Contestant } from "../data/arena";
import { loadLedgerTrack } from "../data/ledgerTrack";
import { useResource } from "../hooks/useResource";
import { arenaValue } from "../lib/arenaWords";
import { HowToRead } from "./HowToRead";

export function LiveTrackRecord({ target, contestants }: { target: ArenaTarget; contestants: Contestant[] }) {
  const { state } = useResource(loadLedgerTrack);
  if (state.kind !== "ready") return null;
  const data = state.data;
  const scored = data.scored.filter((row) => row.target === target.id);
  const pending = data.pending.filter((row) => row.target === target.id);
  const waiting = pending.reduce((n, row) => n + row.rows, 0);
  const label = (id: string) => contestants.find((c) => c.id === id)?.label ?? id;
  return <section className="live-track" aria-labelledby="live-track-title">
    <p className="section-kicker">Recorded before. Checked after.</p>
    <h3 className="t-h3" id="live-track-title">Live verified track record</h3>
    <p className="muted">A separate record of forecasts locked before publication. Historical replays stay in the leaderboard above.</p>
    {!scored.length ? <div className="track-waiting" role="status">
      <span className="track-count num">{waiting}</span>
      <div><strong>{waiting ? "Forecasts awaiting their first published number" : "No forecasts awaiting publication"}</strong>
        <p>No recorded forecast has been scored yet for {target.label.toLowerCase()}. {waiting} ledger {waiting === 1 ? "forecast is" : "forecasts are"} waiting across {pending.length} {pending.length === 1 ? "release" : "releases"}. The table fills in as releases are published.</p></div>
    </div> : <>
      <table className="arena-table arena-subtable" role="table"><caption>{target.label}. Error units: {target.unit}.</caption>
        <thead role="rowgroup"><tr role="row">{["Model", "Releases scored", "MAE", "RMSE", "Beat naive"].map((name) => <th key={name} scope="col" role="columnheader">{name}</th>)}</tr></thead>
        <tbody role="rowgroup">{data.summary.filter((row) => row.target === target.id).map((row) => {
          const naivePeriods = new Set(scored.filter((r) => r.model_id === "naive").map((r) => r.reference_period));
          const paired = scored.filter((r) => r.model_id === row.model_id && naivePeriods.has(r.reference_period)).length;
          return <tr key={row.model_id} role="row"><th scope="row" role="rowheader">{label(row.model_id)}</th>
            <td data-label="Releases scored" role="cell">{row.n}</td><td data-label="MAE" role="cell">{arenaValue(row.mae)}</td>
            <td data-label="RMSE" role="cell">{arenaValue(row.rmse)}</td><td data-label="Beat naive" role="cell">{row.beat_naive === null ? "Not available" : `${row.beat_naive} of ${paired}`}</td></tr>;
        })}</tbody>
      </table>
      <details className="arena-details track-records"><summary>Inspect the recorded forecasts</summary>
        <ul className="track-record-list">{scored.map((row) => <li key={row.sequence}>
          <strong>{row.reference_period}: {label(row.model_id)}</strong>
          <dl>{[["Forecast", arenaValue(row.forecast)], ["First published", arenaValue(row.actual)], ["Absolute error", arenaValue(row.abs_error)], ["Recorded at", row.recorded_at_utc]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        </li>)}</ul>
      </details>
    </>}
    {data.late > 0 && <p className="t-micro muted">Rows recorded after the release date were not scored: {data.late}. This count covers all targets and includes records made on the release date.</p>}
    <HowToRead subject="table"><p>Forecasts recorded in the public ledger before a release are scored against the first published number afterwards.</p>
      <p>Smaller error is closer. Beat naive counts the periods in which a model was closer than the naive forecast, out of releases both forecast.</p>
      <p>A handful of releases shows nothing about skill. The ledger keeps the first forecast recorded for each period, and records made on or after the release date are excluded.</p></HowToRead>
  </section>;
}
