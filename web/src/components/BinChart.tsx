import type { KeyboardEvent } from "react";

import type { Bin } from "../data/types";
import { MINUS } from "../lib/format";
import { useWidth } from "./useWidth";

interface Props {
  bins: Bin[];
  labels: string[];
  // probability of the same bin at T-7d, null where that bin was not listed yet
  ghost: (number | null)[];
  firstPrintIndex: number;
  activeIndex: number | null;
  onHover: (i: number | null) => void;
  onPin: (i: number | null) => void;
}

// columns need room for their labels; narrower charts switch to one row per bin
const MIN_COLUMN_LAYOUT = 560;
const CHAR_PX = 6.6;

// top of the probability axis: the next 10% step above the tallest bar or ghost
function axisMax(values: number[]): number {
  const top = Math.max(0.1, ...values);
  return Math.min(1, Math.ceil(top * 10 - 1e-9) / 10);
}

function pctLabel(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function BinChart({ bins, labels, ghost, firstPrintIndex, activeIndex, onHover, onPin }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const n = bins.length;
  const yMax = axisMax([...bins.map((b) => b[2]), ...ghost.filter((g): g is number => g !== null)]);
  const hasGhost = ghost.some((g) => g !== null);
  const maxChars = Math.max(1, ...labels.map((l) => l.length));

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (n === 0) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const from = activeIndex ?? (step > 0 ? -1 : n);
      onPin(Math.min(n - 1, Math.max(0, from + step)));
    } else if (e.key === "Escape") {
      onPin(null);
    }
  }

  const svgProps = {
    className: "chart-svg",
    tabIndex: 0,
    role: "group",
    "aria-label": "Outcome probabilities at the selected hour. Use the arrow keys to inspect bins.",
    onKeyDown,
    onMouseLeave: () => onHover(null),
  };

  let content = null;
  if (width > 0 && n > 0 && width >= MIN_COLUMN_LAYOUT) {
    const padL = 40;
    const padR = 8;
    const padT = 48;
    const plotH = 200;
    const plotW = width - padL - padR;
    const colW = plotW / n;
    const rotate = maxChars * CHAR_PX > colW - 6;
    const padB = rotate ? 18 + maxChars * CHAR_PX * 0.72 : 28;
    const height = padT + plotH + padB;
    const barW = Math.min(44, colW * 0.72);
    const y = (p: number) => padT + plotH - (p / yMax) * plotH;
    const gridStep = yMax > 0.5 ? 0.2 : 0.1;
    const grid = [];
    for (let k = 1; k * gridStep <= yMax + 1e-9; k++) grid.push(k * gridStep);

    content = (
      <svg {...svgProps} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={padL} x2={padL + plotW} y1={y(g)} y2={y(g)} stroke="var(--border)" />
            <text x={padL - 6} y={y(g) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
              {pctLabel(g)}
            </text>
          </g>
        ))}
        {hasGhost && (
          <text x={padL + plotW} y={14} textAnchor="end" fontSize="12" fill="var(--text-muted)">
            Dashed outline: T{MINUS}7d
          </text>
        )}
        {bins.map((b, i) => {
          const cx = padL + i * colW + colW / 2;
          const x = cx - barW / 2;
          const g = ghost[i] ?? null;
          const top = Math.min(y(b[2]), g === null ? Infinity : y(g));
          const isPrint = i === firstPrintIndex;
          const showValue = colW >= 26 && b[2] >= 0.005;
          const labelY = padT + plotH + 18;
          return (
            <g key={`${b[0]}|${b[1]}`}>
              {i === activeIndex && (
                <rect x={padL + i * colW} y={padT - 8} width={colW} height={plotH + 8} fill="var(--accent-tint)" />
              )}
              <rect x={x} y={y(b[2])} width={barW} height={padT + plotH - y(b[2])} fill="var(--market)" opacity={0.9} />
              {g !== null && (
                <rect
                  x={x} y={y(g)} width={barW} height={padT + plotH - y(g)}
                  fill="none" stroke="var(--ghost)" strokeWidth={1.5} strokeDasharray="3 3"
                />
              )}
              {isPrint && (
                <>
                  <rect
                    x={x - 2} y={y(b[2]) - 2} width={barW + 4} height={padT + plotH - y(b[2]) + 2}
                    fill="none" stroke="var(--actual)" strokeWidth={2.5}
                  />
                  <text x={cx} y={top - (showValue ? 22 : 6)} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--actual)">
                    First print
                  </text>
                </>
              )}
              {showValue && (
                <text x={cx} y={top - 6} textAnchor="middle" fontSize="12" fontWeight="500" fill="var(--text)" className="num">
                  {pctLabel(b[2])}
                </text>
              )}
              {rotate ? (
                <text
                  x={cx} y={labelY - 6} textAnchor="end" fontSize="12" fill="var(--text)" className="num"
                  transform={`rotate(-40 ${cx} ${labelY - 6})`}
                >
                  {labels[i]}
                </text>
              ) : (
                <text x={cx} y={labelY} textAnchor="middle" fontSize="12" fill="var(--text)" className="num">
                  {labels[i]}
                </text>
              )}
              <rect
                className="bin-hit" x={padL + i * colW} y={padT - 8} width={colW} height={plotH + padB}
                fill="transparent" onMouseEnter={() => onHover(i)} onClick={() => onPin(i)}
              />
            </g>
          );
        })}
        <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="var(--border-control)" />
      </svg>
    );
  } else if (width > 0 && n > 0) {
    const padL = Math.min(120, maxChars * 7 + 10);
    const padR = 92;
    const padT = hasGhost ? 26 : 4;
    const rowH = 24;
    const barH = 14;
    const plotW = Math.max(40, width - padL - padR);
    const height = padT + n * rowH + 4;
    const w = (p: number) => (p / yMax) * plotW;

    content = (
      <svg {...svgProps} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {hasGhost && (
          <text x={width} y={14} textAnchor="end" fontSize="12" fill="var(--text-muted)">
            Dashed outline: T{MINUS}7d
          </text>
        )}
        {bins.map((b, i) => {
          const cy = padT + i * rowH + rowH / 2;
          const g = ghost[i] ?? null;
          const isPrint = i === firstPrintIndex;
          return (
            <g key={`${b[0]}|${b[1]}`}>
              {i === activeIndex && <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="var(--accent-tint)" />}
              <text
                x={padL - 8} y={cy + 4} textAnchor="end" fontSize="12" className="num"
                fontWeight={isPrint ? 600 : 400} fill="var(--text)"
              >
                {labels[i]}
              </text>
              <rect x={padL} y={cy - barH / 2} width={w(b[2])} height={barH} fill="var(--market)" opacity={0.9} />
              {g !== null && (
                <rect
                  x={padL} y={cy - barH / 2} width={w(g)} height={barH}
                  fill="none" stroke="var(--ghost)" strokeWidth={1.5} strokeDasharray="3 3"
                />
              )}
              {isPrint && (
                <rect
                  x={padL} y={cy - barH / 2 - 2} width={w(b[2]) + 2} height={barH + 4}
                  fill="none" stroke="var(--actual)" strokeWidth={2}
                />
              )}
              <text
                x={padL + Math.max(w(b[2]), g === null ? 0 : w(g)) + 6} y={cy + 4}
                fontSize="12" fill="var(--text)" className="num" fontWeight={isPrint ? 600 : 400}
              >
                {pctLabel(b[2])}
                {isPrint ? " first print" : ""}
              </text>
              <rect
                className="bin-hit" x={0} y={cy - rowH / 2} width={width} height={rowH}
                fill="transparent" onMouseEnter={() => onHover(i)} onClick={() => onPin(i)}
              />
            </g>
          );
        })}
        <line x1={padL} x2={padL} y1={padT} y2={height - 4} stroke="var(--border-control)" />
      </svg>
    );
  }

  return (
    <div ref={ref} className="chart-box">
      {content}
      {n === 0 && <p className="muted">No outcome bins at this hour.</p>}
    </div>
  );
}
