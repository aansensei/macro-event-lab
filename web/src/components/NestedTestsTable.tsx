import type { ArenaTarget, ArenaWindow, Contestant, NestedTest } from "../data/arena";
import { arenaCount, arenaPValue, arenaValue } from "../lib/arenaWords";
import { HowToRead } from "./HowToRead";

export function NestedTestsTable({ tests, contestants, target, window }: {
  tests: NestedTest[]; contestants: Contestant[]; target: ArenaTarget; window: ArenaWindow;
}) {
  const matching = tests.filter((row) => row.target === target.id && row.window === window);
  if (!matching.length) return null;
  const labelFor = (id: string) => contestants.find((entry) => entry.id === id)?.label ?? id;
  return <details className="arena-details">
    <summary>Nested model tests (Clark and West)</summary>
    <HowToRead subject="table">
      <p>Each row compares a larger model against a smaller model it contains.</p>
      <p>A small p value means the larger model forecasts better than chance explains (one sided).</p>
      <p>A large value does not show the models are equal.</p>
    </HowToRead>
    <table className="arena-table arena-subtable arena-nested-table" role="table">
      <caption>{target.label}. Clark and West nested model comparisons.</caption>
      <thead role="rowgroup"><tr role="row">
        {["Restricted", "Larger", "Periods", "Statistic", "p value"].map((label) => (
          <th key={label} scope="col" role="columnheader">{label}</th>
        ))}
      </tr></thead>
      <tbody role="rowgroup">{matching.map((row) => <tr key={`${row.restricted}:${row.larger}`} role="row">
        <th scope="row" role="rowheader" data-label="Restricted">{labelFor(row.restricted)}</th>
        <td data-label="Larger" role="cell">{labelFor(row.larger)}</td>
        <td data-label="Periods" role="cell">{arenaCount(row.n)}</td>
        <td data-label="Statistic" role="cell">{arenaValue(row.statistic)}</td>
        <td data-label="p value" role="cell">{arenaPValue(row.p_value)}</td>
      </tr>)}</tbody>
    </table>
    <p className="t-micro muted">{matching.length} tests are shown in this table. No correction for several comparisons is applied.</p>
  </details>;
}
