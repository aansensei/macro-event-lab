import type { Arena, TargetId } from "../data/arena";
import type { Revisions } from "../data/types";
import { periodLabel } from "./revisionWords";

export interface ReleaseEntry { id: string; label: string; kind: string; value: number }
export interface ReleaseCase {
  target: TargetId;
  period: string;
  madeOn: string;
  actual: number;
  median: number;
  entries: ReleaseEntry[];
  next: number | null;
  latest: number | null;
}

const JOBS_PER_THOUSAND = 1000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// the release of one target whose first published number lay farthest from the median forecast
export function pickReleaseCase(arena: Arena, revisions: Revisions, target: TargetId): ReleaseCase | null {
  const labels = new Map(arena.contestants.map((c) => [c.id, c]));
  let best: { gap: number; row: Arena["forecasts"][number]; entries: ReleaseEntry[]; middle: number } | null = null;
  for (const row of arena.forecasts) {
    if (row.target !== target || row.actual === null) continue;
    const entries: ReleaseEntry[] = [];
    for (const [id, value] of Object.entries(row.values)) {
      const contestant = labels.get(id);
      if (value !== null && contestant) entries.push({ id, label: contestant.label, kind: contestant.kind, value });
    }
    if (entries.length < 2) continue;
    const middle = median(entries.map((e) => e.value));
    const gap = Math.abs(row.actual - middle);
    if (best === null || gap > best.gap) best = { gap, row, entries, middle };
  }
  if (best === null || best.row.actual === null) return null;
  const series = revisions.series.find((s) => s.series === target);
  const point = series?.points.find((p) => p.period === best.row.period);
  const scale = target === "payrolls" ? JOBS_PER_THOUSAND : 1;
  return {
    target, period: best.row.period, madeOn: best.row.made_on, actual: best.row.actual,
    median: best.middle, entries: best.entries.sort((a, b) => a.value - b.value),
    next: point?.next == null ? null : point.next / scale,
    latest: point?.latest == null ? null : point.latest / scale,
  };
}

export function formatReleaseValue(target: TargetId, value: number): string {
  const sign = value < 0 ? "−" : "";
  const size = Math.abs(value);
  if (target === "payrolls") return `${sign}${Math.round(size).toLocaleString("en-US")} thousand jobs`;
  return `${sign}${size.toFixed(1)}${target === "gdp" ? "% annualized" : "% m/m"}`;
}

export function releaseSentence(c: ReleaseCase): string {
  const gap = Math.abs(c.actual - c.median);
  const direction = c.actual > c.median ? "above" : "below";
  const distance = c.target === "payrolls"
    ? formatReleaseValue(c.target, gap)
    : `${gap.toFixed(1)} percentage points`;
  const base = `Forecasts made on ${c.madeOn} centered on ${formatReleaseValue(c.target, c.median)}. The first published number was ${formatReleaseValue(c.target, c.actual)}, ${distance} ${direction} that.`;
  if (c.latest === null) return base;
  return `${base} Today the figure for ${periodLabel(c.target, c.period)} stands at ${formatReleaseValue(c.target, c.latest)}.`;
}
