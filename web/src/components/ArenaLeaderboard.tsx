import { useState } from "react";

import type { ArenaTarget } from "../data/arena";
import { sortLeaderboard, type ArenaSort, type LeaderboardRow } from "../lib/arenaStats";
import { arenaCount, arenaPValue, arenaValue, contestantKind, coverageIntervalNote, coveragePercent } from "../lib/arenaWords";
import { Select } from "./Select";

const SORT_OPTIONS: { value: ArenaSort; label: string }[] = [
  { value: "rmse", label: "RMSE" }, { value: "mae", label: "MAE" },
  { value: "label", label: "Contestant" }, { value: "coverage_90", label: "Interval coverage" }, { value: "n", label: "Period count" },
];

export function ArenaLeaderboard({ rows, target }: { rows: LeaderboardRow[]; target: ArenaTarget }) {
  const [sort, setSort] = useState<ArenaSort>("rmse");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const ordered = sortLeaderboard(rows, sort, direction);
  function changeSort(value: ArenaSort) {
    if (sort === value) setDirection(direction === "asc" ? "desc" : "asc");
    else { setSort(value); setDirection(value === "n" || value === "coverage_90" ? "desc" : "asc"); }
  }
  return <>
    <div className="arena-sort-controls">
      <Select label="Sort leaderboard" value={sort} options={SORT_OPTIONS} onChange={(value) => changeSort(value as ArenaSort)} />
      <button type="button" className="play-btn" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} aria-label="Reverse leaderboard sort direction">
        {direction === "asc" ? "Ascending" : "Descending"}
      </button>
    </div>
    <p className="t-micro muted" role="status">Sorted by {SORT_OPTIONS.find((option) => option.value === sort)?.label}, {direction === "asc" ? "ascending" : "descending"}. Ranks always use RMSE.</p>
    {!rows.length ? <p className="state-banner">No scores are available for this target and window.</p>
      : <table className="arena-table" role="table"><caption>{target.label}. Error units: {target.unit}.</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">RMSE rank</th>
          {(["label", "rmse", "mae"] as const).map((column) => <th scope="col" role="columnheader" key={column}
            aria-sort={sort === column ? direction === "asc" ? "ascending" : "descending" : "none"}>
            <button type="button" className="text-btn" onClick={() => changeSort(column)}>{SORT_OPTIONS.find((option) => option.value === column)?.label}</button>
          </th>)}
          <th scope="col" role="columnheader">RMSE difference from naive</th>
          {(["coverage_90", "n"] as const).map((column) => <th scope="col" role="columnheader" key={column}
            aria-sort={sort === column ? direction === "asc" ? "ascending" : "descending" : "none"}>
            <button type="button" className="text-btn" onClick={() => changeSort(column)}>{column === "n" ? "Periods" : "90% coverage"}</button>
          </th>)}<th scope="col" role="columnheader">DM p value</th><th scope="col" role="columnheader">Worst period share</th>
          <th scope="col" role="columnheader">RMSE without 2020</th></tr></thead>
        <tbody role="rowgroup">{ordered.map((row) => {
          const intervalNote = coverageIntervalNote(row.coverage_90_lo, row.coverage_90_hi, row.n_intervals);
          return <tr key={row.contestant} role="row">
          <td data-label="RMSE rank" role="cell">{row.rank ?? "Not ranked"}</td>
          <th scope="row" role="rowheader"><strong>{row.contestantInfo.label}</strong><span className="arena-kind">{contestantKind(row.contestantInfo.kind)}</span><small>{row.contestantInfo.note}</small></th>
          <td data-label="RMSE" role="cell">{arenaValue(row.rmse)}</td>
          <td data-label="MAE" role="cell">{arenaValue(row.mae)}</td>
          <td data-label="RMSE difference from naive" role="cell">{row.relative === null ? "Not available" : `${row.relative > 0 ? "+" : ""}${row.relative.toFixed(1)}%`}</td>
          <td data-label="90% coverage" role="cell">{row.coverage_90 === null ? "Not available" : <>
            {coveragePercent(row.coverage_90)}
            {intervalNote && <small>{intervalNote}</small>}
          </>}</td>
          <td data-label="Periods" role="cell">{arenaCount(row.n)}</td>
          <td data-label="DM p value" role="cell">{arenaPValue(row.dm_vs_naive_p)}</td>
          <td data-label="Worst period share" role="cell">{row.worstShare === null ? "Not available" : `${(100 * row.worstShare).toFixed(0)}%`}</td>
          <td data-label="RMSE without 2020" role="cell">{row.rmseWithout2020 === null ? "Not available" : <>
            {arenaValue(row.rmseWithout2020)}
            {row.relativeWithout2020 !== null && <small>{`${row.relativeWithout2020 > 0 ? "+" : ""}${row.relativeWithout2020.toFixed(1)}% vs naive`}</small>}
          </>}</td>
        </tr>;
        })}</tbody>
      </table>}
    <p className="t-micro muted">The RMSE difference is 100 times (contestant RMSE divided by naive RMSE, minus one). It is unavailable when the baseline is missing or zero. P values are two-sided comparisons against naive, not measures of effect direction or evidence of equality. Counts may differ between contestants. Both RMSEs in a percent difference are taken over the periods that contestant forecast. No multiple-comparison adjustment is applied, and {rows.filter((row) => row.dm_vs_naive_p !== null).length} p values are shown in this table. The worst period share is the part of a contestant's total squared error that comes from its single largest miss: a high share means one extreme period, such as spring 2020, drives the RMSE. The last column repeats the RMSE with every period of 2020 left out, and the percentage compares it with the naive forecast over the same periods. It is a sensitivity check shown beside the scored result: the scored RMSE and the ranks keep 2020, as the protocol requires, and the column is shown for the all periods window only.</p>
  </>;
}
