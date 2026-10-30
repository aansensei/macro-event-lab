import type { NowcastPoint } from "../data/nowcast";
import { niceTicks } from "../lib/charts";
import { useWidth } from "../hooks/useWidth";

export function NowcastChart({ points }: { points: NowcastPoint[] }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const width = measured || 600, height = 300;
  if (!points.length) return <p>No evaluated quarters are available.</p>;
  const values = points.flatMap((p) => [p.nowcast, p.first_print]);
  const lo = Math.min(...values) - 1, hi = Math.max(...values) + 1;
  const start = Date.parse(points[0]!.reference_period), end = Date.parse(points.at(-1)!.reference_period);
  const x = (p: NowcastPoint) => 44 + (Date.parse(p.reference_period) - start) / (end - start || 1) * (width - 60);
  const y = (v: number) => 18 + (hi - v) / (hi - lo) * (height - 54);
  const path = (key: "nowcast" | "first_print") => points.map((p, i) => `${i ? "L" : "M"}${x(p)},${y(p[key])}`).join(" ");
  const labelIndices = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  return <div ref={ref} className="nowcast-chart">
    <p className="chart-legend"><span className="legend-model">Dashed: nowcast</span><span>Solid: first print</span></p>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label="GDP nowcast and first published annualized growth over time. Exact values are in the table below.">
      {niceTicks(lo, hi).map((v) => <g key={v}><line x1="44" x2={width - 16} y1={y(v)} y2={y(v)} stroke="var(--border)" />
        <text x="36" y={y(v) + 4} textAnchor="end" fill="var(--text-muted)" fontSize="12">{v}%</text></g>)}
      <path d={path("first_print")} fill="none" stroke="var(--actual)" strokeWidth="2" />
      <path d={path("nowcast")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" />
      {labelIndices.map((i) => <text key={i} x={x(points[i]!)} y={height - 10}
        textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
        fill="var(--text-muted)" fontSize="12">{points[i]!.reference_period.slice(0, 4)}</text>)}
    </svg>
  </div>;
}
