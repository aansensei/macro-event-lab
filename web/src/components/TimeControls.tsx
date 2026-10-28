import { MINUS, formatEt, hourLabel } from "../lib/format";

const PRESETS: [number, string][] = [
  [168, `T${MINUS}7d`],
  [48, `T${MINUS}48h`],
  [24, `T${MINUS}24h`],
  [1, `T${MINUS}1h`],
  [0, "Close"],
];

interface Props {
  h: number;
  ts: string | null;
  max: number;
  min: number;
  playing: boolean;
  onHour: (h: number) => void;
  onPlay: () => void;
}

// the slider runs left to right toward the close, so its value is minus the hours before close
export function TimeControls({ h, ts, max, min, playing, onHour, onPlay }: Props) {
  const when = ts ? formatEt(ts) : "";
  return (
    <div className="time-control-bar" role="group" aria-label="Point-in-time controls">
      <button type="button" className="play-btn" onClick={onPlay} aria-label={playing ? "Pause" : "Play hour by hour"}>
        {playing ? "Pause" : "Play"}
      </button>
      <div className="slider-wrap">
        <div className="slider-top-labels">
          <span>{hourLabel(max)}</span>
          <span className="num slider-current">{hourLabel(h)}{when && ` (${when})`}</span>
          <span>{hourLabel(min)}</span>
        </div>
        <label htmlFor="time-range-slider" className="sr-only">Hours before the market closes</label>
        <input
          id="time-range-slider"
          type="range"
          className="time-slider"
          min={-max}
          max={-min}
          step={1}
          value={-h}
          aria-valuetext={`${h === 0 ? "At the close" : `${h} hours before the close`}${when && `, ${when}`}`}
          onChange={(e) => onHour(-Number(e.target.value))}
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
