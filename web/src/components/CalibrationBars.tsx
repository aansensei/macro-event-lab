import type { SeriesSummary } from "../data/types";
import { pct } from "../lib/format";

// for each series, how often the real number landed inside the market's 50% and 90% ranges, against the ideal
export function CalibrationBars({ series }: { series: SeriesSummary[] }) {
  return (
    <div className="calibration" role="table" aria-label="Share of releases inside the market's ranges">
      {series.map((s) => (
        <div key={s.series} className="calibration-series" role="rowgroup">
          <div className="calibration-label" role="rowheader">{s.label} <span className="muted">({s.n})</span></div>
          {([["50% range", s.hit_50, 0.5], ["90% range", s.hit_90, 0.9]] as const).map(([name, hit, ideal]) => (
            <div key={name} className="calibration-row" role="row">
              <span className="calibration-name" role="cell">{name}</span>
              <span className="calibration-track" role="cell" aria-label={hit === null ? "no data" : `${pct(hit)}, ideal ${pct(ideal)}`}>
                {hit !== null && <span className="calibration-bar" style={{ width: `${hit * 100}%` }} />}
                <span className="calibration-ideal" style={{ left: `${ideal * 100}%` }} />
              </span>
              <span className="calibration-value num" role="cell">{hit === null ? "n/a" : pct(hit)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
