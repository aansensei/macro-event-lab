import type { SeriesSummary } from "../data/types";
import { pct } from "../lib/format";
import { CountUp } from "./CountUp";
import { useCountUp } from "../hooks/useCountUp";
import { HowToRead } from "./HowToRead";

// a bar that grows from zero together with its count-up percentage
function HitRow({ name, hit, ideal }: { name: string; hit: number | null; ideal: number }) {
  const grown = useCountUp(hit ?? 0);
  return (
    <div className="calibration-row" role="row">
      <span className="calibration-name" role="cell">{name}</span>
      <span className="calibration-track" role="cell" aria-label={hit === null ? "no data" : `${pct(hit)}, ideal ${pct(ideal)}`}>
        {hit !== null && <span className="calibration-bar" style={{ width: `${grown * 100}%` }} />}
        <span className="calibration-ideal" style={{ left: `${ideal * 100}%` }} />
      </span>
      <span className="calibration-value num" role="cell">
        {hit === null ? "n/a" : <CountUp value={hit} format={(v) => pct(v)} />}
      </span>
    </div>
  );
}

// for each series, how often the real number landed inside the market's 50% and 90% ranges, against the ideal
export function CalibrationBars({ series }: { series: SeriesSummary[] }) {
  return (
    <>
    <div className="calibration" role="table" aria-label="Share of releases inside the market's ranges">
      {series.map((s) => (
        <div key={s.series} className="calibration-series" role="rowgroup">
          <div className="calibration-label" role="rowheader">{s.label} <span className="muted">({s.n})</span></div>
          <HitRow name="50% range" hit={s.hit_50} ideal={0.5} />
          <HitRow name="90% range" hit={s.hit_90} ideal={0.9} />
        </div>
      ))}
    </div>
    <HowToRead>
      <p>
        Each bar is the share of releases whose real number landed inside the market's range, and the tick on the
        track is the share an ideal market would catch: 50 percent for the 50 percent range and 90 percent for the
        90 percent range. A bar that stops short of the tick means the market was too confident, and a bar past it
        means the market was too cautious. The number in brackets is how many releases were counted.
      </p>
    </HowToRead>
    </>
  );
}
