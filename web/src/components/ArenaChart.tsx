import { useId, useState } from "react";

import type { ArenaForecast, ArenaTarget, Contestant } from "../data/arena";
import { useWidth } from "../hooks/useWidth";
import { arenaRange } from "../lib/arenaStats";
import { forecastReadout } from "../lib/arenaWords";
import { niceTicks } from "../lib/charts";
import { periodLabel } from "../lib/revisionWords";

export function ArenaChart({ target, points, contestant }: {
  target: ArenaTarget; points: ArenaForecast[]; contestant: Contestant | undefined;
}) {
  const [ref, measuredWidth] = useWidth<HTMLElement>();
  const [active, setActive] = useState<number | null>(null);
  const readoutId = useId();
  const width = Math.max(520, measuredWidth - 34);
  const height = 300;
  const left = 54; const right = width - 16; const top = 14; const bottom = 258;
  const values = points.map((point) => contestant ? point.values[contestant.id] ?? null : null);
  const intervals = points.map((point) => contestant ? point.intervals[contestant.id] : null);
  const { maximum } = arenaRange(points.flatMap((point, index) =>
    [point.actual, values[index] ?? null, intervals[index]?.lo ?? null, intervals[index]?.hi ?? null]));
  const x = (index: number) => left + (points.length === 1 ? 0.5 : index / Math.max(1, points.length - 1)) * (right - left);
  const y = (value: number) => top + (1 - Math.max(-1, Math.min(1, value / maximum))) * (bottom - top) / 2;
  const shown = Math.min(active ?? points.length - 1, points.length - 1);
  const point = points[shown];
  function linePath(series: (number | null)[]): string {
    let previous: number | null = null;
    return series.map((value, index) => {
      const command = value === null ? "" : `${previous === null ? "M" : "L"}${x(index)},${y(value)}`;
      previous = value;
      return command;
    }).join(" ");
  }
  function pick(clientX: number, element: SVGSVGElement) {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0) return;
    const position = (clientX - rect.left) * width / rect.width;
    setActive(Math.max(0, Math.min(points.length - 1, Math.round((position - left) / (right - left) * (points.length - 1)))));
  }
  return <figure className="arena-chart" ref={ref}>
    <figcaption>{target.label}. First print and {contestant?.label ?? "selected forecast"}.</figcaption>
    {!points.length ? <p className="state-banner">No forecast history is available for this target.</p> : <>
      <p className="arena-readout num" id={readoutId} aria-live="polite">{point ? forecastReadout(point, target, contestant) : ""}</p>
      <p className="t-micro muted">Hover, tap or use Left, Right, Home and End to inspect a period. History includes supplied calibration periods; the leaderboard alone uses the selected evaluation window.</p>
      <div className="arena-chart-scroll">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" tabIndex={0}
          aria-label={`${target.label} forecast history. Use the arrow keys to inspect periods.`} aria-describedby={readoutId}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget)} onPointerDown={(event) => pick(event.clientX, event.currentTarget)}
          onKeyDown={(event) => {
            const moves: Record<string, number> = { ArrowLeft: Math.max(0, shown - 1), ArrowRight: Math.min(points.length - 1, shown + 1), Home: 0, End: points.length - 1 };
            if (event.key in moves) { event.preventDefault(); setActive(moves[event.key] ?? shown); }
          }}>
          {niceTicks(-maximum, maximum, 4).filter((tick) => Math.abs(tick) <= maximum).map((tick) => <g key={tick}>
            <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" />
            <text x={left - 6} y={y(tick) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="12">{tick.toLocaleString("en-US", { maximumFractionDigits: 2 })}</text>
          </g>)}
          {intervals.map((interval, index) => {
            if (!interval || interval.lo === null || interval.hi === null) return null;
            const next = intervals[index + 1];
            return <g key={index} className="arena-interval">
              <line x1={x(index)} x2={x(index)} y1={y(interval.lo)} y2={y(interval.hi)} stroke="var(--accent)" strokeOpacity="0.4" />
              {next && next.lo !== null && next.hi !== null && <polygon points={`${x(index)},${y(interval.lo)} ${x(index)},${y(interval.hi)} ${x(index + 1)},${y(next.hi)} ${x(index + 1)},${y(next.lo)}`} fill="var(--band-90)" />}
            </g>;
          })}
          <path data-series="actual" d={linePath(points.map((point) => point.actual))} fill="none" stroke="var(--actual)" strokeWidth="2" />
          <path data-series="forecast" d={linePath(values)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" />
          {points.map((point, index) => <g key={point.period}>
            {[point.actual, values[index] ?? null].map((value, series) => value === null ? null : <circle key={series} cx={x(index)} cy={y(value)} r="3" fill={series ? "var(--accent)" : "var(--actual)"} />)}
            {[point.actual, values[index] ?? null, intervals[index]?.lo ?? null, intervals[index]?.hi ?? null].map((value, series) => value !== null && Math.abs(value) > maximum
              ? <path data-clipped="true" key={`clip-${series}`} d={`M${x(index)} ${y(value)} l-4 ${value > 0 ? 7 : -7} h8 Z`} fill="var(--text)" /> : null)}
          </g>)}
          {point && <line x1={x(shown)} x2={x(shown)} y1={top} y2={bottom} stroke="var(--accent)" strokeDasharray="3 3" />}
          {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((index) => <text key={index} x={x(index)} y={height - 12}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill="var(--text-muted)" fontSize="12">{periodLabel(target.id, points[index]!.period)}</text>)}
        </svg>
      </div>
      <p className="t-micro muted">Solid: first print. Dashed: selected forecast. Shading: supplied 90 percent interval. Triangles mark clipped values; the readout retains full values. The scale uses the 98th percentile of absolute plotted values with a margin.</p>
    </>}
  </figure>;
}
