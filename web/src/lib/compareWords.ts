// One plain English finding per series, read from its statistics across every scored release.

import type { SeriesSummary } from "../data/types";
import { seriesKind } from "./format";

const MIN_CORR = 0.3;
// a market is called calibrated when its ranges catch the number this close to 50% and 90% of the time
const TOLERANCE_50 = 0.07;
const TOLERANCE_90 = 0.05;
// FOMC surprises this small mean the decision was priced well before the meeting
const PRICED_IN_SD = 0.2;

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export type Verdict = "calibrated" | "overconfident" | "cautious" | "priced-in" | "unknown";

export function verdict(s: SeriesSummary): Verdict {
  if (seriesKind(s.series) === "fomc" && s.mean_abs_sd !== null && s.mean_abs_sd < PRICED_IN_SD) {
    return "priced-in";
  }
  if (s.hit_50 === null || s.hit_90 === null) return "unknown";
  if (Math.abs(s.hit_50 - 0.5) <= TOLERANCE_50 && Math.abs(s.hit_90 - 0.9) <= TOLERANCE_90) {
    return "calibrated";
  }
  if (s.hit_50 < 0.5 - TOLERANCE_50 || s.hit_90 < 0.9 - TOLERANCE_90) return "overconfident";
  return "cautious";
}

export function seriesFinding(s: SeriesSummary): string {
  const v = verdict(s);
  if (v === "priced-in") {
    return (
      `Across ${s.n} Fed meetings the average absolute surprise was ${(s.mean_abs_sd as number).toFixed(2)} SD. ` +
      "Daily yield changes also include the statement and other news. These data do not isolate the effect of the rate decision."
    );
  }
  const parts: string[] = [];
  const ranges =
    s.hit_50 !== null && s.hit_90 !== null
      ? `the official number fell inside the market's 90% range ${pct(s.hit_90)} of the time and its 50% range ${pct(s.hit_50)}, against ideals of 90% and 50%`
      : "";
  if (v === "calibrated") parts.push(`Across ${s.n} ${s.label} releases, markets were well calibrated: ${ranges}.`);
  if (v === "overconfident") {
    parts.push(`Across ${s.n} ${s.label} releases, markets were a little overconfident: ${ranges}, so their ranges were somewhat too narrow.`);
  }
  if (v === "cautious") {
    parts.push(`Across ${s.n} ${s.label} releases, markets were a little cautious: ${ranges}, so their ranges were somewhat too wide.`);
  }
  if (s.mean_abs_sd !== null) parts.push(`The typical miss was ${s.mean_abs_sd.toFixed(1)} SD.`);
  if (s.dgs2_corr !== null && s.dgs2_bp_per_sd !== null) {
    parts.push(
      Math.abs(s.dgs2_corr) >= MIN_CORR
        ? `A 1 SD surprise was associated with a daily 2-year Treasury yield change of about ${Math.abs(s.dgs2_bp_per_sd).toFixed(1)} bp ${s.dgs2_bp_per_sd > 0 ? "in the same direction" : "the other way"} (correlation ${s.dgs2_corr.toFixed(2)}).`
        : `The linear association between surprises and daily 2-year yield changes was weak (correlation ${s.dgs2_corr.toFixed(2)}).`,
    );
  }
  return parts.join(" ");
}
