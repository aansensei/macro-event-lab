import { useState, type KeyboardEvent } from "react";

import type { RevisionPoint } from "../data/types";
import { niceTicks } from "../lib/charts";
import { MINUS } from "../lib/format";
import { periodLabel, printValue, signedSize } from "../lib/revisionWords";
import { useWidth } from "./useWidth";

interface Props {
  series: string;
  unit: string;
  points: RevisionPoint[];
}

const PAD_L = 52;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 28;
// the scale covers this share of revisions; the few larger ones are cut at the edge and marked
const SCALE_QUANTILE = 0.98;

function revision(p: RevisionPoint): number | null {
  return p.latest === null ? null : p.latest - p.first;
}

function axisLabel(unit: string, v: number): string {
  if (v === 0) return "0";
  const sign = v > 0 ? "+" : MINUS;
  return unit === "jobs" ? `${sign}${Math.abs(v) / 1000}k` : `${sign}${Math.abs(v)}`;
}

// one bar per period: how far today's number sits from the first print, newest on the right;
// hovering, tapping or the arrow keys pick a period and the line above reads it out
export function RevisionChart({ series, unit, points }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const sizes = points.map(revision).filter((v): v is number => v !== null).map(Math.abs).sort((a, b) => a - b);
  const cap = sizes[Math.min(sizes.length - 1, Math.floor(sizes.length * SCALE_QUANTILE))] ?? 0;
  const yMax = Math.max(cap * 1.15, unit === "jobs" ? 10000 : 0.1);
  const height = width < 560 ? 240 : 300;
  const plotW = Math.max(40, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const band = plotW / Math.max(1, points.length);
  const y = (v: number) => PAD_T + plotH / 2 - (Math.max(-yMax, Math.min(yMax, v)) / yMax) * (plotH / 2);
  const yTicks = niceTicks(-yMax, yMax, 4).filter((t) => Math.abs(t) <= yMax);
  const years = points.map((p) => Number(p.period.slice(0, 4)));
  const span = (years[years.length - 1] ?? 0) - (years[0] ?? 0);
  const step = width < 560 ? (span > 15 ? 10 : 5) : span > 15 ? 5 : 2;
  const xTicks = points
    .map((p, i) => ({ i, year: Number(p.period.slice(0, 4)), january: p.period.slice(5, 7) === "01" }))
    .filter((t) => t.january && t.year % step === 0);

  const shown = Math.min(active ?? points.length - 1, points.length - 1);
  const point = points[shown];
  const rev = point ? revision(point) : null;
  let readout = "";
  if (point) {
    readout = `${periodLabel(series, point.period)}: first ${printValue(unit, point.first)}`;
    readout += point.latest === null
      ? ", not in today's data."
      : `, today ${printValue(unit, point.latest)}, revised ${signedSize(unit, rev ?? 0)}${point.settled ? "." : ", and may still change."}`;
  }

  function pick(clientX: number, target: SVGSVGElement) {
    const box = target.getBoundingClientRect();
    const i = Math.floor((clientX - box.left - PAD_L) / band);
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const next: Record<string, number> = {
      ArrowLeft: Math.max(0, shown - 1),
      ArrowRight: Math.min(points.length - 1, shown + 1),
      Home: 0,
      End: points.length - 1,
    };
    if (e.key in next) {
      e.preventDefault();
      setActive(next[e.key] ?? shown);
    }
  }

  return (
    <div ref={ref} className="chart-box">
      <p className="rev-readout num" aria-live="polite">{readout}</p>
      {width > 0 && (
        <svg
          className="chart-svg rev-chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          role="img" tabIndex={0}
          aria-label={`Revision of each first print, ${points.length} periods. Use the arrow keys to read a period.`}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
          onKeyDown={onKey}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--border-control)" : "var(--border)"} />
              <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                {axisLabel(unit, t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t.i} x={PAD_L + (t.i + 0.5) * band} y={height - 8} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="num">
              {t.year}
            </text>
          ))}
          {points.map((p, i) => {
            const v = revision(p);
            if (v === null) return null;
            const top = Math.min(y(0), y(v));
            const h = Math.max(1, Math.abs(y(v) - y(0)));
            const mid = PAD_L + (i + 0.5) * band;
            const edge = v > 0 ? PAD_T : PAD_T + plotH;
            const tip = v > 0 ? 6 : -6;
            return (
              <g key={p.period} opacity={p.settled ? 1 : 0.4}>
                <rect
                  x={PAD_L + i * band + band * 0.12} y={top} width={Math.max(1, band * 0.76)} height={h}
                  fill={v > 0 ? "var(--surprise-up)" : v < 0 ? "var(--surprise-down)" : "var(--border-control)"}
                />
                {Math.abs(v) > yMax && (
                  <path d={`M${mid - 4} ${edge + tip} L${mid + 4} ${edge + tip} L${mid} ${edge} Z`} fill="var(--text)" />
                )}
              </g>
            );
          })}
          {point && (
            <line
              x1={PAD_L + (shown + 0.5) * band} x2={PAD_L + (shown + 0.5) * band} y1={PAD_T} y2={PAD_T + plotH}
              stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="3 3"
            />
          )}
        </svg>
      )}
    </div>
  );
}
