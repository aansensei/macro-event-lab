import type { ArenaTarget, CalibrationRow, Contestant } from "../data/arena";
import { HowToRead } from "./HowToRead";

const LEVELS = [0.5, 0.8, 0.9];

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// observed coverage of the 50, 80 and 90 percent intervals for the selected target, beside what each level promises
export function CoverageCalibration({ rows, contestants, target }: { rows: CalibrationRow[]; contestants: Contestant[]; target: ArenaTarget }) {
  const mine = rows.filter((row) => row.target === target.id);
  const ids = contestants.map((contestant) => contestant.id).filter((id) => mine.some((row) => row.contestant === id));
  if (ids.length === 0) return null;
  return <details className="arena-details">
    <summary>Do the intervals mean what they say?</summary>
    <HowToRead subject="table">
      <p>Each interval is built from a contestant's recent errors and promises to hold the real number 50, 80 or 90 percent of the time.</p>
      <p>The table shows how often it did. A cell close to its level means the interval is honest; a cell far below means it was too narrow, far above means too wide.</p>
      <p>The range under each figure is a 95 percent interval of the share, and a few dozen forecasts leave it wide.</p>
    </HowToRead>
    <table className="arena-table arena-subtable calibration-table" role="table">
      <caption>{target.label}. Share of releases inside the interval.</caption>
      <thead role="rowgroup"><tr role="row">
        <th scope="col" role="columnheader">Contestant</th>
        {LEVELS.map((level) => <th key={level} scope="col" role="columnheader">Promised {percent(level)}</th>)}
      </tr></thead>
      <tbody role="rowgroup">{ids.map((id) => <tr key={id} role="row">
        <th scope="row" role="rowheader">{contestants.find((c) => c.id === id)?.label ?? id}</th>
        {LEVELS.map((level) => {
          const row = mine.find((entry) => entry.contestant === id && entry.level === level);
          return <td key={level} data-label={`Promised ${percent(level)}`} role="cell">
            {row ? <>
              <span className="num">{percent(row.coverage)}</span>
              <small>{percent(row.coverage_lo)} to {percent(row.coverage_hi)}, {row.n} releases</small>
            </> : "Not available"}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </details>;
}
