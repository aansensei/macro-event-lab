import type { CSSProperties } from "react";

import { MINUS, formatEt, hourLabel } from "../lib/format";
import { adjacentHour } from "../lib/snapshots";

const PRESETS: [number, string][] = [
  [168, `T${MINUS}7d`],
  [48, `T${MINUS}48h`],
  [24, `T${MINUS}24h`],
  [1, `T${MINUS}1h`],
  [0, "Close hour"],
];

interface Props {
  h: number;
  hours: number[];
  ts: string | null;
  max: number;
  min: number;
  playing: boolean;
  onHour: (h: number) => void;
  onPlay: () => void;
  reducedMotion?: boolean;
}

// The slider runs toward the close hour, with values stored as negative relative snapshot hours.
export function TimeControls({ h, hours, ts, max, min, playing, onHour, onPlay, reducedMotion = false }: Props) {
  const when = ts ? formatEt(ts) : "";
  return (
    <div className="time-control-bar" role="group" aria-label="Point-in-time controls">
      <button type="button" className="play-btn" onClick={onPlay} aria-label={reducedMotion ? "Step forward in time" : playing ? "Pause" : "Play hour by hour"}>
        {reducedMotion ? "Step" : playing ? "Pause" : "Play"}
      </button>
      <div className="slider-wrap">
        <div className="slider-top-labels">
          <span className="slider-end">{hourLabel(max)}</span>
          <span className="num slider-current">{hourLabel(h)}{when && ` (${when})`}</span>
          <span className="slider-end">{hourLabel(min)}</span>
        </div>
        <label htmlFor="time-range-slider" className="sr-only">Market snapshot hour</label>
        <input
          id="time-range-slider"
          type="range"
          className="time-slider"
          min={-max}
          max={-min}
          step={1}
          value={-h}
          // share of the track already passed, painted in the accent color
          style={{ "--fill": `${max === min ? 100 : ((max - h) / (max - min)) * 100}%` } as CSSProperties}
          aria-valuetext={`${h === 0 ? "The market close hour" : `${h} ${h === 1 ? "hour" : "hours"} before the market close hour`}${when && `, ${when}`}`}
          onChange={(e) => onHour(-Number(e.target.value))}
          onKeyDown={(e) => {
            const later = e.key === "ArrowRight" || e.key === "ArrowUp";
            const earlier = e.key === "ArrowLeft" || e.key === "ArrowDown";
            if (!later && !earlier) return;
            e.preventDefault();
            onHour(adjacentHour(hours, h, later ? "later" : "earlier"));
          }}
        />
      </div>
      <div className="preset-chips" role="group" aria-label="Jump to an hour">
        {PRESETS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip-btn"
            aria-pressed={h === value}
            disabled={value > max || value < min}
            onClick={() => onHour(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
