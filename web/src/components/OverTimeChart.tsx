import type { KeyboardEvent, PointerEvent, ReactNode } from "react";

import type { Snapshot } from "../data/types";
import { dayTicks, fanDomain, fanSegments, niceTicks, oddsSeries, type Quantiles } from "../lib/charts";
import { MINUS, binLabel, fixed, formatValue, pct } from "../lib/format";
import { snapshotAt } from "../lib/snapshots";
import { useWidth } from "./useWidth";

const PAD_L = 48;
const PAD_T = 12;
const PAD_B = 28;

interface FrameProps {
  maxH: number;
  minH: number;
  h: number;
  padR: number;
  label: string;
  onHour: (h: number) => void;
  children: (geo: { width: number; plotW: number; plotH: number; height: number; x: (h: number) => number }) => ReactNode;
}

// shared time axis: hours before close run left to right toward the close; click or drag to move in time
function TimeFrame({ maxH, minH, h, padR, label, onHour, children }: FrameProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = width < 560 ? 220 : 260;
  const plotW = Math.max(40, width - PAD_L - padR);
  const plotH = height - PAD_T - PAD_B;
  const x = (hour: number) => PAD_L + (maxH > 0 ? (maxH - hour) / maxH : 1) * plotW;
  const clamp = (hour: number) => Math.min(maxH, Math.max(minH, hour));

  function scrub(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const share = (e.clientX - box.left - PAD_L) / plotW;
    onHour(clamp(Math.round(maxH - share * maxH)));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const moves: Record<string, number> = { ArrowLeft: h + 1, ArrowRight: h - 1, Home: maxH, End: minH };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onHour(clamp(next));
  }

  const ticks = dayTicks(maxH).filter((_, i, all) => width >= 480 || i % 2 === 0 || i === all.length - 1);

  return (
    <div ref={ref} className="chart-box">
      {width > 0 && (
        <svg
          className="chart-svg scrub"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          tabIndex={0}
          role="slider"
          aria-label={label}
          aria-valuemin={-maxH}
          aria-valuemax={-minH}
          aria-valuenow={-h}
          aria-valuetext={h === 0 ? "At the close" : `${h} hours before the close`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) scrub(e);
          }}
        >
          {ticks.map((t) => (
            <text key={t} x={x(t)} y={height - 8} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="num">
              {t === 0 ? "Close" : `T${MINUS}${t / 24}d`}
            </text>
          ))}
          {children({ width, plotW, plotH, height, x })}
          <line x1={x(h)} x2={x(h)} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--text)" strokeWidth={1} opacity={0.5} />
        </svg>
      )}
    </div>
  );
}

// tick text with just enough decimals for the step: 0.4%, 0.25%, 50k
function tickLabel(v: number, step: number, unit: string | null): string {
  if (unit === "jobs") return formatValue(v, unit);
  let digits = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  if (Math.abs(step * 10 ** digits - Math.round(step * 10 ** digits)) > 1e-6) digits += 1;
  return `${fixed(v, digits)}${unit?.startsWith("%") ? "%" : ""}`;
}

function bandPath(seg: Quantiles[], x: (h: number) => number, y: (v: number) => number, top: "p95" | "p75", bottom: "p05" | "p25") {
  const upper = seg.map((q) => `${x(q.h).toFixed(1)},${y(q[top]).toFixed(1)}`);
  const lower = [...seg].reverse().map((q) => `${x(q.h).toFixed(1)},${y(q[bottom]).toFixed(1)}`);
  return `M${upper.join("L")}L${lower.join("L")}Z`;
}

interface FanProps {
  snaps: Snapshot[];
  h: number;
  maxH: number;
  minH: number;
  unit: string | null;
  firstPrint: number | null;
  onHour: (h: number) => void;
}

// median with 50% and 90% bands for every hour, plus the first print once it exists
export function FanChart({ snaps, h, maxH, minH, unit, firstPrint, onHour }: FanProps) {
  const segments = fanSegments(snaps);
  const [lo, hi] = fanDomain(segments, [firstPrint]);
  const yTicks = niceTicks(lo, hi, 4);
  const step = yTicks.length > 1 ? (yTicks[1] as number) - (yTicks[0] as number) : 1;
  const selected = snapshotAt(snaps, h);
  const printLabel = firstPrint === null ? "" : `First print ${formatValue(firstPrint, unit)}`;

  return (
    <TimeFrame
      maxH={maxH} minH={minH} h={h} padR={12} onHour={onHour}
      label="Implied median and ranges by hour. Use the arrow keys to move in time."
    >
      {({ plotW, plotH, x }) => {
        const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;
        return (
          <>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" />
                <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                  {tickLabel(t, step, unit)}
                </text>
              </g>
            ))}
            {segments.map((seg) => (
              <g key={seg[0]?.h}>
                <path d={bandPath(seg, x, y, "p95", "p05")} fill="var(--band-90)" />
                <path d={bandPath(seg, x, y, "p75", "p25")} fill="var(--band-50)" />
                <polyline
                  points={seg.map((q) => `${x(q.h).toFixed(1)},${y(q.p50).toFixed(1)}`).join(" ")}
                  fill="none" stroke="var(--median)" strokeWidth={2}
                />
              </g>
            ))}
            {firstPrint !== null && (
              <>
                <line
                  x1={PAD_L} x2={PAD_L + plotW} y1={y(firstPrint)} y2={y(firstPrint)}
                  stroke="var(--actual)" strokeWidth={1.5} strokeDasharray="5 4"
                />
                <text
                  x={PAD_L + 6} y={y(firstPrint) + (y(firstPrint) < PAD_T + 16 ? 16 : -6)}
                  fontSize="12" fontWeight="600" fill="var(--actual)" className="num"
                >
                  {printLabel}
                </text>
              </>
            )}
            {selected && selected.p50 !== null && (
              <circle cx={x(selected.h)} cy={y(selected.p50)} r={4} fill="var(--median)" stroke="var(--bg)" strokeWidth={2} />
            )}
          </>
        );
      }}
    </TimeFrame>
  );
}

interface OddsProps {
  snaps: Snapshot[];
  h: number;
  maxH: number;
  minH: number;
  unit: string | null;
  resolution: number | null;
  onHour: (h: number) => void;
}

const ODDS_COLORS = ["var(--odds-1)", "var(--odds-2)", "var(--odds-3)", "var(--odds-4)"];
const LABEL_GAP = 15;

// one line per rate outcome that reached 10% at some hour, ordered from the lowest rate up
export function OddsChart({ snaps, h, maxH, minH, unit, resolution, onHour }: OddsProps) {
  const series = oddsSeries(snaps);
  const labels = series.map((s) => binLabel(s.bin, unit, resolution));
  // two lines take the lightest and a dark shade so they stay easy to tell apart
  const colors = series.length <= 2 ? [ODDS_COLORS[0], ODDS_COLORS[2]] : ODDS_COLORS;
  const padR = 28 + Math.max(0, ...labels.map((l) => l.length)) * 7 + 40;

  return (
    <TimeFrame
      maxH={maxH} minH={minH} h={h} padR={padR} onHour={onHour}
      label="Probability of each rate outcome by hour. Use the arrow keys to move in time."
    >
      {({ plotW, plotH, x }) => {
        const y = (p: number) => PAD_T + plotH - p * plotH;
        // end labels sit at each line's last value, pushed apart so they never overlap
        const ends = series
          .map((s, i) => {
            const last = [...s.points].reverse().find((pt) => pt[1] !== null);
            return { i, p: last?.[1] ?? 0, y: y(last?.[1] ?? 0) };
          })
          .sort((a, b) => a.y - b.y);
        for (let k = 1; k < ends.length; k++) {
          const prev = ends[k - 1] as (typeof ends)[number];
          const cur = ends[k] as (typeof ends)[number];
          cur.y = Math.max(cur.y, prev.y + LABEL_GAP);
        }
        return (
          <>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" />
                <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                  {pct(t)}
                </text>
              </g>
            ))}
            {series.map((s, i) => {
              const runs: string[][] = [[]];
              for (const [hour, p] of s.points) {
                if (p === null) runs.push([]);
                else runs[runs.length - 1]?.push(`${x(hour).toFixed(1)},${y(p).toFixed(1)}`);
              }
              return runs
                .filter((r) => r.length > 0)
                .map((r, j) => (
                  <polyline key={`${s.key}-${j}`} points={r.join(" ")} fill="none" stroke={colors[i]} strokeWidth={2} />
                ));
            })}
            {ends.map((e) => (
              <g key={series[e.i]?.key}>
                <line
                  x1={PAD_L + plotW + 6} x2={PAD_L + plotW + 20} y1={e.y} y2={e.y}
                  stroke={colors[e.i]} strokeWidth={3}
                />
                <text x={PAD_L + plotW + 24} y={e.y + 4} fontSize="12" fontWeight="500" fill="var(--text)" className="num">
                  {labels[e.i]} {pct(e.p)}
                </text>
              </g>
            ))}
          </>
        );
      }}
    </TimeFrame>
  );
}
