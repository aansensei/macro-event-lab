import type { SummaryPoint } from "../data/types";
import { niceTicks } from "../lib/charts";
import { MINUS, fixed, formatBp, signed } from "../lib/format";
import type { Fit } from "../lib/stats";
import { useWidth } from "./useWidth";

interface Props {
  points: SummaryPoint[];
  yieldKey: "dgs2_bp" | "dgs10_bp";
  fit: Fit | null;
}

const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 36;

// one dot per release: surprise in SD across, release-day yield change in bp up; each dot opens its event
export function SurpriseScatter({ points, yieldKey, fit }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const usable = points.filter((p) => p[yieldKey] !== null);
  const xs = usable.map((p) => p.surprise_sd);
  const ys = usable.map((p) => p[yieldKey] as number);
  const xMax = Math.max(1, ...xs.map(Math.abs)) * 1.08;
  const yMax = Math.max(5, ...ys.map(Math.abs)) * 1.08;
  const height = width < 560 ? 280 : 340;
  const plotW = Math.max(40, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const x = (v: number) => PAD_L + ((v + xMax) / (2 * xMax)) * plotW;
  const y = (v: number) => PAD_T + plotH - ((v + yMax) / (2 * yMax)) * plotH;
  const xTicks = niceTicks(-xMax, xMax, width < 560 ? 4 : 6);
  const yTicks = niceTicks(-yMax, yMax, 5);

  return (
    <div ref={ref} className="chart-box">
      {width > 0 && (
        <svg
          className="chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}
          role="img" aria-label={`Surprise against release-day yield change for ${usable.length} releases`}
        >
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD_L} x2={PAD_L + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--border-control)" : "var(--border)"} />
              <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                {t === 0 ? "0" : `${t > 0 ? "+" : MINUS}${Math.abs(t)}`}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={x(t)} x2={x(t)} y1={PAD_T} y2={PAD_T + plotH} stroke={t === 0 ? "var(--border-control)" : "var(--border)"} />
              <text x={x(t)} y={PAD_T + plotH + 16} textAnchor="middle" fontSize="12" fill="var(--text-muted)" className="num">
                {t === 0 ? "0" : signed(t, Number.isInteger(t) ? 0 : 1)}
              </text>
            </g>
          ))}
          <text x={PAD_L + plotW} y={height - 4} textAnchor="end" fontSize="12" fill="var(--text-muted)">
            Surprise (SD)
          </text>
          <text x={PAD_L + 4} y={PAD_T + 12} fontSize="12" fill="var(--text-muted)">Yield change (bp)</text>
          {fit && (
            <line
              x1={x(-xMax)} y1={y(fit.intercept - fit.slope * xMax)}
              x2={x(xMax)} y2={y(fit.intercept + fit.slope * xMax)}
              stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4"
            />
          )}
          {usable.map((p) => (
            <a key={p.id} href={`?event=${p.id}`} className="scatter-dot">
              <title>{`${p.title}: surprise ${fixed(p.surprise_sd, 2)} SD, yield ${formatBp(p[yieldKey] as number)}`}</title>
              <circle cx={x(p.surprise_sd)} cy={y(p[yieldKey] as number)} r={5} fill="var(--market)" fillOpacity={0.55} stroke="var(--market)" />
            </a>
          ))}
        </svg>
      )}
    </div>
  );
}
