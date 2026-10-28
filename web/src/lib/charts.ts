// Scales and series for the charts over time; snapshots are sorted by h descending.

import type { Bin, Snapshot } from "../data/types";
import { binKey } from "./snapshots";

// round steps of 1, 2, 2.5 or 5 times a power of ten, covering [lo, hi] with about `target` ticks
export function niceTicks(lo: number, hi: number, target = 4): number[] {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const power = 10 ** Math.floor(Math.log10(span / target));
  const intervals = (m: number) => Math.abs(span / (m * power) - target);
  const step = [1, 2, 2.5, 5, 10].reduce((best, m) => (intervals(m) < intervals(best) ? m : best)) * power;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  }
  return ticks;
}

// a tick every 24 hours from the first snapshot down to the close
export function dayTicks(maxH: number): number[] {
  const ticks: number[] = [];
  for (let h = Math.floor(maxH / 24) * 24; h >= 0; h -= 24) ticks.push(h);
  return ticks;
}

export type Quantiles = { h: number; p05: number; p25: number; p50: number; p75: number; p95: number };

// runs of consecutive snapshots that have every quantile, so gaps break the bands
export function fanSegments(snaps: Snapshot[]): Quantiles[][] {
  const segments: Quantiles[][] = [];
  let current: Quantiles[] = [];
  for (const s of snaps) {
    if (s.p05 === null || s.p25 === null || s.p50 === null || s.p75 === null || s.p95 === null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push({ h: s.h, p05: s.p05, p25: s.p25, p50: s.p50, p75: s.p75, p95: s.p95 });
  }
  if (current.length) segments.push(current);
  return segments;
}

// value range of the 90% band and any extra marks such as the first print, padded by 5%
export function fanDomain(segments: Quantiles[][], extra: (number | null)[] = []): [number, number] {
  const values = segments.flat().flatMap((q) => [q.p05, q.p95]);
  for (const v of extra) if (v !== null) values.push(v);
  if (values.length === 0) return [0, 1];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = hi > lo ? (hi - lo) * 0.05 : Math.max(Math.abs(hi) * 0.05, 0.05);
  return [lo - pad, hi + pad];
}

export interface OddsSeries {
  key: string;
  bin: Bin;
  peak: number;
  // probability at each snapshot hour; null where the outcome was not listed yet
  points: [h: number, p: number | null][];
}

// outcomes that reached minPeak at some hour, the `limit` likeliest of them, ordered low to high
export function oddsSeries(snaps: Snapshot[], minPeak = 0.1, limit = 4): OddsSeries[] {
  const byKey = new Map<string, OddsSeries>();
  for (const s of snaps) {
    for (const b of s.bins) {
      const key = binKey(b);
      const series = byKey.get(key) ?? { key, bin: b, peak: 0, points: [] };
      series.peak = Math.max(series.peak, b[2]);
      byKey.set(key, series);
    }
  }
  const chosen = [...byKey.values()]
    .filter((s) => s.peak >= minPeak)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, limit)
    .sort((a, b) => (a.bin[0] ?? -Infinity) - (b.bin[0] ?? -Infinity));
  for (const series of chosen) {
    series.points = snaps.map((s) => {
      const bin = s.bins.find((b) => binKey(b) === series.key);
      return [s.h, bin ? bin[2] : null];
    });
  }
  return chosen;
}
