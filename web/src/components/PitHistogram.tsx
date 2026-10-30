import { useWidth } from "../hooks/useWidth";

const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;
const HEIGHT = 140;

// counts of PIT values in ten bins from 0 to 1, with a dashed line where a calibrated market would sit
export function PitHistogram({ hist, label }: { hist: number[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const total = hist.reduce((a, b) => a + b, 0);
  const ideal = total / hist.length;
  const top = Math.max(1, ideal * 1.5, ...hist);
  const plotW = Math.max(40, width - PAD_L - PAD_R);
  const plotH = HEIGHT - PAD_T - PAD_B;
  const colW = plotW / hist.length;
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;

  return (
    <div ref={ref} className="chart-box">
      {width > 0 && (
        <svg
          className="chart-svg" width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img" aria-label={`${label}: where ${total} real numbers landed within the market's odds, in ten bins from 0 to 1`}
        >
          {hist.map((c, i) => (
            <rect
              key={i} x={PAD_L + i * colW + 2} y={y(c)} width={Math.max(1, colW - 4)} height={PAD_T + plotH - y(c)}
              rx={3} fill="var(--market)" opacity={i === 0 || i === hist.length - 1 ? 1 : 0.7}
            >
              <title>{`${(i / 10).toFixed(1)} to ${((i + 1) / 10).toFixed(1)}: ${c} releases`}</title>
            </rect>
          ))}
          <line x1={PAD_L} x2={PAD_L + plotW} y1={y(ideal)} y2={y(ideal)} stroke="var(--text)" strokeWidth={1.5} strokeDasharray="5 4" />
          <line x1={PAD_L} x2={PAD_L + plotW} y1={PAD_T + plotH} y2={PAD_T + plotH} stroke="var(--border-control)" />
          {[0, 0.5, 1].map((t) => (
            <text key={t} x={PAD_L + t * plotW} y={HEIGHT - 6} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"} fontSize="12" fill="var(--text-muted)" className="num">
              {t}
            </text>
          ))}
          <text x={PAD_L - 6} y={y(ideal) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)" className="num">
            {ideal.toFixed(0)}
          </text>
        </svg>
      )}
    </div>
  );
}
