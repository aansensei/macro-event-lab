import { ECONOMIC_PERIODS, type ArenaTarget, type Contestant, type RegimeScore } from "../data/arena";
import { arenaValue } from "../lib/arenaWords";
import { HowToRead } from "./HowToRead";

export function EconomicPeriods({ rows, contestants, target }: { rows: RegimeScore[]; contestants: Contestant[]; target: ArenaTarget }) {
  const mine = rows.filter((row) => row.target === target.id);
  if (!mine.length) return null;
  return <details className="arena-details economic-periods">
    <summary>Scores by economic period</summary>
    <p className="muted">One average can hide a shock. Read each column as its own sample.</p>
    <HowToRead subject="table"><p>The same forecast errors are split into well known economic periods.</p>
      <p>Compare a model with the naive forecast inside one period, rather than across periods, because errors are larger in shocks.</p>
      <p>These periods were chosen after seeing the data and each holds few forecasts. A period with fewer than 4 forecasts is not scored.</p></HowToRead>
    <table className="arena-table arena-subtable regime-table" role="table"><caption>{target.label}. RMSE difference from naive over the same releases. Error units: {target.unit}.</caption>
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Contestant</th>{ECONOMIC_PERIODS.map((period) => <th key={period.id} scope="col" role="columnheader">{period.label}</th>)}</tr></thead>
      <tbody role="rowgroup">{contestants.filter((c) => mine.some((r) => r.contestant === c.id)).map((c) => <tr key={c.id} role="row">
        <th scope="row" role="rowheader">{c.label}</th>{ECONOMIC_PERIODS.map((period) => {
          const row = mine.find((r) => r.contestant === c.id && r.regime === period.id);
          return <td key={period.id} data-label={period.label} role="cell">{!row ? "No forecast" : row.n < 4 ? <>Too few<small>{row.n} forecasts</small></> : <>
            <span className="num">{row.vs_naive_pct === null ? c.id === "naive" ? "Baseline" : "Not available" : `${row.vs_naive_pct > 0 ? "+" : ""}${row.vs_naive_pct.toFixed(0)}%`}</span>
            <small>RMSE {arenaValue(row.rmse)}</small><small>{row.n} forecasts</small>
          </>}</td>;
        })}</tr>)}</tbody>
    </table>
    <p className="t-micro muted">These periods were chosen after the results were known. They describe the sample and do not rank forecasters.</p>
  </details>;
}
