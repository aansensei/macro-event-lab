import type { SurvivalPoint } from "../data/types";
import { formatValue, pct } from "../lib/format";
import { useTween } from "../hooks/useTween";
import { useWidth } from "../hooks/useWidth";

export type ThresholdMode = "fit" | "raw";

interface Props {
  survival: SurvivalPoint[];
  unit: string | null;
  mode: ThresholdMode;
}

const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 16;
const CHAR_PX = 6.6;

// P(X > k) at each listed strike; the fit is never rising, the raw prices can be
export function ThresholdChart({ survival, unit, mode }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = survival.length;
  const labels = survival.map(([k]) => formatValue(k, unit));
  const plotW = Math.max(40, width - PAD_L - PAD_R);
  const colW = n > 0 ? plotW / n : plotW;
  const rotate = Math.max(1, ...labels.map((l) => l.length)) * CHAR_PX > colW - 4;
  const padB = rotate ? 20 + Math.max(...labels.map((l) => l.length)) * CHAR_PX * 0.72 : 26;
  const plotH = 180;
  const height = PAD_T + plotH + padB;
  const x = (i: number) => PAD_L + i * colW + colW / 2;
  const y = (p: number) => PAD_T + plotH - Math.min(1, Math.max(0, p)) * plotH;
  const main = mode === "fit" ? 2 : 1;
  const other = mode === "fit" ? 1 : 2;
  // both lines glide when the hour or the Fit/Raw choice changes; a new set of strikes redraws at once
  const tweened = useTween(
    [...survival.map((s) => s[main]), ...survival.map((s) => s[other])],
    survival.map((s) => s[0]).join(","),
  );
  const mainVals = tweened.slice(0, n);
  const otherVals = tweened.slice(n);
  const line = (vals: number[]) => vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <div ref={ref} className="chart-box">
      {width > 0 && n > 0 && (
        <svg
          className="chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          role="img" aria-label={`Probability above each strike, ${mode === "fit" ? "fitted" : "raw contract prices"}`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" />
              <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                {pct(t)}
              </text>
            </g>
          ))}
          <polyline points={line(otherVals)} fill="none" stroke="var(--ghost)" strokeWidth={1} strokeDasharray="3 3" />
          <polyline points={line(mainVals)} fill="none" stroke="var(--market)" strokeWidth={2} />
          {survival.map((s, i) => (
            <g key={s[0]}>
              <circle
                cx={x(i)} cy={y(mainVals[i] ?? s[main])} r={3.5}
                fill={mode === "fit" ? "var(--market)" : "var(--bg)"} stroke="var(--market)" strokeWidth={1.5}
              />
              {rotate ? (
                <text
                  x={x(i)} y={PAD_T + plotH + 18} textAnchor="end" fontSize="12" fill="var(--text)" className="num"
                  transform={`rotate(-40 ${x(i)} ${PAD_T + plotH + 18})`}
                >
                  {labels[i]}
                </text>
              ) : (
                <text x={x(i)} y={PAD_T + plotH + 18} textAnchor="middle" fontSize="12" fill="var(--text)" className="num">
                  {labels[i]}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
      {n === 0 && <p className="muted">No strikes priced at this hour.</p>}
    </div>
  );
}
