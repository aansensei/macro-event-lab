// Plain English reading of how much a series' first prints were revised afterwards.

import type { RevisionSeries } from "../data/types";
import { MINUS } from "./format";

// below this share of the typical revision, the next report is said to change "very little"
const EARLY_LOW = 0.25;
// from this share, "most" of the typical revision already shows up in the next report
const EARLY_HIGH = 0.6;
// an average revision smaller than this share of the typical one counts as having no direction
const BIAS = 0.25;

// a revision or level in the series' own unit: "0.08 points" or "74,000 jobs"
export function revisionSize(unit: string, v: number): string {
  if (unit === "jobs") return `${(Math.round(Math.abs(v) / 1000) * 1000).toLocaleString("en-US")} jobs`;
  return `${Math.abs(v).toFixed(2)} points`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// the period a number describes: "Mar 2020" for monthly series, "Q2 2020" for GDP
export function periodLabel(series: string, period: string): string {
  const [y, m] = period.split("-").map(Number);
  const month = m ?? 1;
  if (series === "KXGDP") return `Q${Math.floor((month - 1) / 3) + 1} ${y}`;
  return `${MONTHS[month - 1]} ${y}`;
}

// a printed value: "0.4%" or "−701,000 jobs"
export function printValue(unit: string, v: number): string {
  if (unit === "jobs") return `${v < 0 ? MINUS : ""}${Math.abs(v).toLocaleString("en-US")} jobs`;
  return `${v < 0 ? MINUS : ""}${Math.abs(v).toFixed(1)}%`;
}

export function signedSize(unit: string, v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? MINUS : "";
  return `${sign}${revisionSize(unit, v)}`;
}

export function revisionFinding(s: RevisionSeries, since: string): string {
  const typical = s.mean_abs_revision;
  if (typical === null || s.n === 0) return `There are not enough settled ${s.label} numbers to measure revisions yet.`;
  const parts: string[] = [];
  const scale = s.mean_abs_first ? ` That is about ${Math.round((typical / s.mean_abs_first) * 100)}% of the size of a typical ${s.label} number (${revisionSize(s.unit, s.mean_abs_first)}).` : "";
  parts.push(`Since ${since}, a ${s.label} first print has moved by ${revisionSize(s.unit, typical)} on average by today's data.${scale}`);

  if (s.mean_abs_next !== null) {
    const early = typical > 0 ? s.mean_abs_next / typical : 0;
    parts.push(
      early < EARLY_LOW
        ? `The very next report changed it by only ${revisionSize(s.unit, s.mean_abs_next)}; most of the revision arrived months or years later.`
        : early < EARLY_HIGH
          ? `The next report already moved it by ${revisionSize(s.unit, s.mean_abs_next)} on average, and the rest came later.`
          : `Most of that change showed up in the very next report (${revisionSize(s.unit, s.mean_abs_next)} on average).`,
    );
  }

  if (s.mean_revision !== null && s.share_up !== null && s.share_down !== null) {
    const up = Math.round(s.share_up * 100);
    const down = Math.round(s.share_down * 100);
    parts.push(
      Math.abs(s.mean_revision) < BIAS * typical
        ? `Revisions had no clear direction: ${up}% went up and ${down}% went down.`
        : `Revisions leaned ${s.mean_revision > 0 ? "up" : "down"}: ${up}% went up, ${down}% went down, and the average was ${signedSize(s.unit, s.mean_revision)}.`,
    );
  }
  return parts.join(" ");
}
