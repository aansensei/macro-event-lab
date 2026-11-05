import { useId, useState } from "react";

import type { Snapshot } from "../data/types";
import { oddsSeries } from "../lib/charts";
import { binLabel, formatEt, formatValue, hourLabel, pct } from "../lib/format";

export function TimelineData({ snapshots, odds, unit, resolution }: {
  snapshots: Snapshot[]; odds: boolean; unit: string | null; resolution: number | null;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const series = open && odds ? oddsSeries(snapshots) : [];
  const value = (number: number | null) => number === null ? "Unavailable"
    : unit === "jobs" ? `${number.toLocaleString("en-US", { maximumFractionDigits: 2 })} jobs` : formatValue(number, unit, true);

  return <div className="timeline-data">
    <button type="button" className="text-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      {open ? "Hide timeline data" : "Show timeline data"}
    </button>
    {open && <div id={id}>
      <p className="t-micro muted">All recorded hours are shown. Values are rounded for display. Unavailable means no usable value in that snapshot.</p>
      <div className="data-table-wrap" tabIndex={0} role="region" aria-label="Hourly snapshot data">
        <table className="mel-table num">
          <caption>Market expectations by recorded hour</caption>
          <thead><tr><th scope="col">Snapshot</th><th scope="col">Snapshot time (ET)</th>
            {odds ? series.map(s => <th scope="col" key={s.key}>{binLabel(s.bin, unit, resolution)}</th>)
              : <><th scope="col">Median</th><th scope="col">Middle 50%</th><th scope="col">Middle 90%</th></>}
          </tr></thead>
          <tbody>{snapshots.map(s => <tr key={`${s.h}-${s.ts}`}>
            <th scope="row">{hourLabel(s.h)}</th><td><time dateTime={s.ts}>{formatEt(s.ts)}</time></td>
            {odds ? series.map(line => {
              const probability = line.points.find(([h]) => h === s.h)?.[1];
              return <td key={line.key}>{probability == null ? "Unavailable" : pct(probability, 1)}</td>;
            }) : <><td>{value(s.p50)}</td>
              {([[s.p25, s.p75], [s.p05, s.p95]] as const).map(([lo, hi], i) => <td key={i}>
                {lo === null || hi === null ? "Unavailable" : `${value(lo)} to ${value(hi)}`}
              </td>)}
            </>}
          </tr>)}</tbody>
        </table>
        {snapshots.length === 0 && <p>No recorded snapshots are available.</p>}
      </div>
    </div>}
  </div>;
}
