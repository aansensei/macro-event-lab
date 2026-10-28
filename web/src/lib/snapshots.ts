// Point-in-time helpers over an event's hourly snapshots (sorted by h descending, h = hours before close).

import type { Bin, ManifestEvent, Snapshot } from "../data/types";
import { formatEtDate, formatIsoDate, seriesKind } from "./format";

const EPS = 1e-9;

// the newest snapshot known at T-h: the smallest snapshot h that is still >= h; null before the first one
export function snapshotAt(snaps: Snapshot[], h: number): Snapshot | null {
  let found: Snapshot | null = null;
  for (const s of snaps) {
    if (s.h >= h && (found === null || s.h < found.h)) found = s;
  }
  return found;
}

export function hourBounds(snaps: Snapshot[]): { max: number; min: number } {
  let max = -Infinity;
  let min = Infinity;
  for (const s of snaps) {
    max = Math.max(max, s.h);
    min = Math.min(min, s.h);
  }
  return { max, min };
}

// T-1h when the event has it, otherwise the newest hour available (open markets stop early)
export function defaultHour(snaps: Snapshot[]): number {
  const { max, min } = hourBounds(snaps);
  return min <= 1 && 1 <= max ? 1 : min;
}

export function binKey(bin: Bin): string {
  return `${bin[0]}|${bin[1]}`;
}

// probability each bin had in an earlier snapshot; null where that exact bin did not exist yet
export function matchBins(bins: Bin[], earlier: Bin[]): (number | null)[] {
  const byKey = new Map(earlier.map((b) => [binKey(b), b[2]]));
  return bins.map((b) => byKey.get(binKey(b)) ?? null);
}

// first bin with the largest probability, or -1 when there are no bins
export function modeIndex(bins: Bin[]): number {
  let best = -1;
  bins.forEach((b, i) => {
    if (best === -1 || b[2] > (bins[best] as Bin)[2]) best = i;
  });
  return best;
}

// bin (lower, upper] that contains the printed value, or -1
export function binIndexOf(bins: Bin[], value: number | null): number {
  if (value === null) return -1;
  return bins.findIndex(
    ([lo, hi]) => (lo === null || value > lo + EPS) && (hi === null || value <= hi + EPS),
  );
}

export type EventStatus = "published" | "upcoming" | "not_published";

// an event without a first print is upcoming while its market closes after the data ends
export function eventStatus(
  entry: Pick<ManifestEvent, "first_print" | "close">,
  dataThrough: string | null,
): EventStatus {
  if (entry.first_print !== null) return "published";
  if (dataThrough !== null && Date.parse(entry.close) > Date.parse(dataThrough)) return "upcoming";
  return "not_published";
}

// release day and clock time; FOMC statements come at 14:00 ET, BLS and BEA data at 08:30 ET
export function releaseWhen(
  entry: Pick<ManifestEvent, "series" | "release_date" | "close">,
): { date: string; time: string } {
  const date = entry.release_date ? formatIsoDate(entry.release_date) : formatEtDate(entry.close);
  return { date, time: seriesKind(entry.series) === "fomc" ? "14:00 ET" : "08:30 ET" };
}
