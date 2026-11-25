import { useState } from "react";

import type { Contestant, LiveForecastRow } from "../data/arena";
import { oddsLabel, probabilityAbove, thresholdsFor } from "../lib/odds";

const MEDIAN_INDEX = 9;

function formatThreshold(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// for one coming release: the chance, from each contestant's past errors, that the number ends up above a chosen level
export function ReleaseOdds({ row, contestants, unit }: { row: LiveForecastRow; contestants: Contestant[]; unit: string }) {
  const entries = contestants.flatMap((contestant) => {
    const quantiles = row.quantiles?.[contestant.id];
    return quantiles ? [{ contestant, quantiles }] : [];
  });
  const middles = entries.map((entry) => entry.quantiles[MEDIAN_INDEX]!).sort((a, b) => a - b);
  const middle = middles.length > 0 ? middles[Math.floor(middles.length / 2)]! : null;
  const thresholds = middle === null ? [] : thresholdsFor(row.target, middle);
  const [selected, setSelected] = useState<number | null>(null);
  if (entries.length === 0 || thresholds.length === 0) return null;
  const threshold = selected !== null && thresholds.includes(selected) ? selected : thresholds[2]!;
  return <div className="release-odds">
    <p className="release-odds-title">Chance the number comes out above a level ({unit})</p>
    <div className="release-odds-chips" role="group" aria-label="Level to compare with">
      {thresholds.map((value) => <button key={value} type="button" className="release-odds-chip num"
        aria-pressed={value === threshold} onClick={() => setSelected(value)}>{formatThreshold(value)}</button>)}
    </div>
    <ul className="release-odds-list">
      {entries.map(({ contestant, quantiles }) => {
        const odds = probabilityAbove(quantiles, threshold);
        return <li key={contestant.id}>
          <span className="release-odds-name">{contestant.label}</span>
          <span className="release-odds-bar" aria-hidden="true"><span style={{ width: `${Math.round(odds.value * 100)}%` }} /></span>
          <span className="release-odds-value num">{oddsLabel(odds)}</span>
        </li>;
      })}
    </ul>
    <p className="t-micro muted">An estimate built from each contestant's forecast and its own recent errors. It is not a market price and not a promise.</p>
  </div>;
}
