import type { ArenaTarget } from "../data/arena";
import type { LeaderboardRow } from "../lib/arenaStats";
import { arenaCount, arenaValue, coveragePercent } from "../lib/arenaWords";
import { HowToRead } from "./HowToRead";

export function MoreScoresTable({ rows, target }: { rows: LeaderboardRow[]; target: ArenaTarget }) {
  const hasScores = rows.some((row) =>
    row.pinball_05 != null || row.pinball_50 != null || row.pinball_95 != null
    || row.aci_coverage_90 != null || row.aci_n != null || row.crps != null || row.crps_n != null,
  );
  if (!hasScores) return null;
  return <details className="arena-details">
    <summary>More scores: pinball loss and adaptive coverage</summary>
    <HowToRead subject="table">
      <p>Pinball loss scores a forecast of a range more heavily when the actual falls far outside the side it leans to; lower is better.</p>
      <p>CRPS scores the whole range of a forecast at once, in the unit of the number: a smaller value means the whole range sat closer to what happened.</p>
      <p>Adaptive coverage is the share of values inside an interval that widens after misses and narrows after hits, shown beside the fixed interval as a sensitivity check.</p>
      <p>A few dozen forecasts cannot separate close scores.</p>
    </HowToRead>
    <table className="arena-table arena-subtable" role="table">
      <caption>{target.label}. Pinball loss and CRPS units: {target.unit}.</caption>
      <thead role="rowgroup"><tr role="row">
        {["Contestant", "Pinball 5%", "Pinball 50%", "Pinball 95%", "Adaptive coverage", "Forecasts scored", "CRPS"].map((label) => (
          <th key={label} scope="col" role="columnheader">{label}</th>
        ))}
      </tr></thead>
      <tbody role="rowgroup">{rows.map((row) => <tr key={row.contestant} role="row">
        <th scope="row" role="rowheader">{row.contestantInfo.label}</th>
        <td data-label="Pinball 5%" role="cell">{arenaValue(row.pinball_05)}</td>
        <td data-label="Pinball 50%" role="cell">{arenaValue(row.pinball_50)}</td>
        <td data-label="Pinball 95%" role="cell">{arenaValue(row.pinball_95)}</td>
        <td data-label="Adaptive coverage" role="cell">{coveragePercent(row.aci_coverage_90)}</td>
        <td data-label="Forecasts scored" role="cell">{arenaCount(row.aci_n)}</td>
        <td data-label="CRPS" role="cell">{arenaValue(row.crps)}</td>
      </tr>)}</tbody>
    </table>
  </details>;
}
