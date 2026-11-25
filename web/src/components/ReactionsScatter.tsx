import { useId, useState } from "react";

import type { ReactionRow } from "../data/reactions";
import { useWidth } from "../hooks/useWidth";
import { niceTicks } from "../lib/charts";
import { MINUS, fixed, formatBp, formatIsoDate, signed } from "../lib/format";
import { ols } from "../lib/stats";
import { HowToRead } from "./HowToRead";

interface Props {
  rows: ReactionRow[];
  unit: string;
  targetLabel: string;
  yieldKey: "d10y_bp" | "d2y_bp";
}

const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 42;
const MIN_LINE_RELEASES = 10;

// scatter plot of first-print surprise against release-day yield change with optional OLS fit
export function ReactionsScatter({ rows, unit, targetLabel, yieldKey }: Props) {
  const [ref, measuredWidth] = useWidth<HTMLDivElement>();
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const clipId = useId();
  const readoutId = useId();

  if (rows.length === 0) {
    return <p className="state-banner">No release reactions are available for {targetLabel} yet.</p>;
  }

  const width = measuredWidth > 0 ? measuredWidth : 560;
  const height = width < 420 ? 280 : 340;
  const plotW = Math.max(40, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const xs = rows.map((row) => row.surprise);
  const ys = rows.map((row) => row[yieldKey]);
  const xSpan = Math.max(0.2, ...xs.map(Math.abs)) * 1.1;
  const ySpan = Math.max(5, ...ys.map(Math.abs)) * 1.1;
  const x = (value: number) => PAD_L + ((value + xSpan) / (2 * xSpan)) * plotW;
  const y = (value: number) => PAD_T + plotH - ((value + ySpan) / (2 * ySpan)) * plotH;
  const xTicks = niceTicks(-xSpan, xSpan, width < 420 ? 4 : 6);
  const yTicks = niceTicks(-ySpan, ySpan, 5);
  const fit = rows.length >= MIN_LINE_RELEASES ? ols(rows.map((row) => [row.surprise, row[yieldKey]])) : null;
  const yieldLabel = yieldKey === "d10y_bp" ? "10-year yield" : "2-year yield";
  const activeRow = rows.find((row) => row.period === activePeriod) ?? rows.at(-1) ?? null;

  return (
    <>
      {activeRow && (
        <p className="reactions-readout num" id={readoutId} aria-live="polite">
          Release {formatIsoDate(activeRow.release_date)} (period {activeRow.period}): surprise{" "}
          {signed(activeRow.surprise, 2)} {unit}, {yieldLabel} {formatBp(activeRow[yieldKey])}.
        </p>
      )}
      <div ref={ref} className="chart-box">
        <svg
          className="chart-svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${targetLabel} surprise against ${yieldLabel} change for ${rows.length} releases`}
          aria-describedby={activeRow ? readoutId : undefined}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD_L} y={PAD_T} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={PAD_L}
                x2={PAD_L + plotW}
                y1={y(tick)}
                y2={y(tick)}
                stroke={tick === 0 ? "var(--border-control)" : "var(--border)"}
              />
              <text x={PAD_L - 6} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)" className="num">
                {tick === 0 ? "0" : `${tick > 0 ? "+" : MINUS}${Math.abs(tick)}`}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={x(tick)}
                x2={x(tick)}
                y1={PAD_T}
                y2={PAD_T + plotH}
                stroke={tick === 0 ? "var(--border-control)" : "var(--border)"}
              />
              <text
                x={x(tick)}
                y={PAD_T + plotH + 16}
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-muted)"
                className="num"
              >
                {tick === 0 ? "0" : signed(tick, Number.isInteger(tick) ? 0 : 1)}
              </text>
            </g>
          ))}
          <text x={PAD_L + plotW} y={height - 4} textAnchor="end" fontSize="12" fill="var(--text-muted)">
            Surprise ({unit})
          </text>
          <text x={PAD_L + 4} y={PAD_T + 12} fontSize="12" fill="var(--text-muted)">
            {yieldLabel} change (bp)
          </text>
          {fit && (
            <line
              clipPath={`url(#${clipId})`}
              x1={x(-xSpan)}
              y1={y(fit.intercept - fit.slope * xSpan)}
              x2={x(xSpan)}
              y2={y(fit.intercept + fit.slope * xSpan)}
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          )}
          {rows.map((row) => {
            const label = `${row.period}, released ${row.release_date}: surprise ${fixed(row.surprise, 2)} ${unit}, ${yieldLabel} ${formatBp(row[yieldKey])}`;
            return (
              <g
                key={row.period}
                className="scatter-dot reactions-dot"
                tabIndex={0}
                role="button"
                aria-label={label}
                onFocus={() => setActivePeriod(row.period)}
                onMouseEnter={() => setActivePeriod(row.period)}
                onClick={() => setActivePeriod(row.period)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActivePeriod(row.period);
                  }
                }}
              >
                <title>{label}</title>
                <circle
                  cx={x(row.surprise)}
                  cy={y(row[yieldKey])}
                  r={5}
                  fill="var(--market)"
                  fillOpacity={0.6}
                  stroke="var(--market)"
                />
              </g>
            );
          })}
        </svg>
      </div>
      {rows.length < MIN_LINE_RELEASES && (
        <p className="reactions-thin-note">Too few releases to draw a line.</p>
      )}
      <HowToRead>
        <p>
          Each dot is one release. Horizontal position is the first published surprise (first print minus the
          benchmark forecast, in {unit}). Vertical position is the release day change in the {yieldLabel} in basis
          points. When at least 10 releases are present, the dashed line shows the least squares fit. Many other news
          events move yields on the same day, so any slope is descriptive only and shows no cause.
        </p>
      </HowToRead>
    </>
  );
}
