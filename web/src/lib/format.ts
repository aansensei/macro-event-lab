// Number, unit and time formatting for the explorer; negative numbers use the true minus sign.

import type { Bin } from "../data/types";

export const MINUS = "−";
const EPS = 1e-9;

export type SeriesKind = "cpi" | "jobs" | "fomc" | "gdp" | "other";

const KINDS: Record<string, SeriesKind> = {
  KXCPI: "cpi",
  KXPAYROLLS: "jobs",
  KXFED: "fomc",
  KXGDP: "gdp",
};

export const KIND_LABEL: Record<SeriesKind, string> = {
  cpi: "CPI",
  jobs: "Jobs",
  fomc: "FOMC",
  gdp: "GDP",
  other: "Other",
};

export function seriesKind(series: string): SeriesKind {
  return KINDS[series] ?? "other";
}

// fixed decimals with a minus sign only when the rounded value is not zero
export function fixed(v: number, digits: number): string {
  const text = Math.abs(v).toFixed(digits);
  return (v < 0 && Number(text) !== 0 ? MINUS : "") + text;
}

// always signed: "+0.2", "−0.4", and "0.0" for values that round to zero
export function signed(v: number, digits: number, suffix = ""): string {
  const text = Math.abs(v).toFixed(digits);
  const sign = Number(text) === 0 ? "" : v > 0 ? "+" : MINUS;
  return sign + text + suffix;
}

function isJobs(unit: string | null): boolean {
  return unit === "jobs";
}

// decimals for a percent unit: FOMC rates move in quarter points, other series print one decimal
function percentDigits(unit: string | null, precise: boolean): number {
  if (unit === "% upper bound") return 2;
  return precise ? 2 : 1;
}

// the number alone, in display units: payrolls in thousands ("29k"), percents without the sign
export function formatNumber(v: number, unit: string | null, precise = false): string {
  if (isJobs(unit)) {
    const thousands = fixed(v / 1000, 0);
    return thousands === "0" ? "0" : `${thousands}k`;
  }
  return fixed(v, percentDigits(unit, precise));
}

// the number with its short unit: "0.6%", "4.00%", "29k"
export function formatValue(v: number, unit: string | null, precise = false): string {
  const text = formatNumber(v, unit, precise);
  return unit?.startsWith("%") ? `${text}%` : text;
}

// splits a unit for the large figures: the leading "%" stays big, the rest is a small caption
export function unitParts(unit: string | null): { lead: string; rest: string } {
  if (!unit) return { lead: "", rest: "" };
  if (unit.startsWith("%")) return { lead: "%", rest: unit.slice(1).trim() };
  return { lead: "", rest: unit };
}

// a change in the release's units: percentage points, or thousands of jobs
export function formatDelta(v: number, unit: string | null): string {
  if (isJobs(unit)) return signed(v / 1000, 1, "k jobs");
  return signed(v, 2, " pp");
}

// readable outcome for a bin (lower, upper]; a bin one resolution step wide is a single printed value
export function binLabel(bin: Bin, unit: string | null, resolution: number | null): string {
  const [lo, hi] = bin;
  const f = (v: number) => formatValue(v, unit);
  if (lo === null && hi === null) return "Any outcome";
  if (lo === null) return `≤ ${f(hi as number)}`;
  if (hi === null) return `> ${f(lo)}`;
  if (resolution === null) return `${f(lo)} to ${f(hi)}`;
  if (Math.abs(hi - lo - resolution) < EPS * Math.max(1, resolution)) return f(hi);
  return `${f(lo + resolution)} to ${f(hi)}`;
}

export function pct(p: number, digits = 0): string {
  return `${(p * 100).toFixed(digits)}%`;
}

// hours before the market closes; 0 is the close itself
export function hourLabel(h: number): string {
  return h === 0 ? "Close" : `T${MINUS}${h}h`;
}

const ET_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function etParts(ts: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of ET_PARTS.formatToParts(new Date(ts))) out[part.type] = part.value;
  return out;
}

// "Oct 12 08:00 ET"
export function formatEt(ts: string): string {
  const p = etParts(ts);
  return `${p.month} ${p.day} ${p.hour}:${p.minute} ET`;
}

// "Oct 14 2026", the New York calendar date of a timestamp
export function formatEtDate(ts: string): string {
  const p = etParts(ts);
  return `${p.month} ${p.day} ${p.year}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-14" as "Oct 14 2026", read as a calendar date with no time zone shift
export function formatIsoDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d} ${y}`;
}
