import type { ArenaTarget, Contestant, LiveForecastRow } from "../data/arena";
import { arenaValue, contestantKind } from "../lib/arenaWords";
import { periodLabel } from "../lib/revisionWords";

export function LiveForecast({ target, contestants, rows }: { target: ArenaTarget; contestants: Contestant[]; rows: LiveForecastRow[] }) {
  const matching = rows.filter((row) => row.target === target.id);
  if (!matching.length) return null;
  return <section className="arena-section" aria-labelledby="arena-live">
    <h2 className="t-h3" id="arena-live">Next release</h2>
    <p className="muted">Forecasts for unreleased periods, using the supplied as-of dates. Values can change as information arrives.</p>
    {matching.map((row) => <article className="arena-live" key={`${row.period}:${row.as_of}`}>
      <h3>{periodLabel(target.id, row.period)}</h3><p>As of <time dateTime={row.as_of}>{row.as_of}</time>. Units: {target.unit}.</p>
      <dl>{contestants.map((contestant) => <div key={contestant.id}>
        <dt>{contestant.label}<span className="arena-kind">{contestantKind(contestant.kind)}</span></dt>
        <dd>{row.values[contestant.id] === null || row.values[contestant.id] === undefined ? "No forecast" : arenaValue(row.values[contestant.id])}</dd>
      </div>)}</dl>
    </article>)}
  </section>;
}
