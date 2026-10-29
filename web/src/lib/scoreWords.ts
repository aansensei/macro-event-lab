// Plain English reading of a series' forecast scores.

import type { SeriesScores } from "../data/types";
import { seriesKind } from "./format";

const UNIT: Record<string, string> = {
  KXCPI: "% m/m",
  KXPAYROLLS: "jobs",
  KXGDP: "% annualized",
  KXFED: "% upper bound",
};

const PREVIOUS: Record<string, string> = {
  cpi: "last month's CPI",
  jobs: "last month's jobs number",
  gdp: "last quarter's GDP growth",
  fomc: "the current rate",
  other: "the previous number",
};

// a typical miss in the series' own unit: "0.07 pp" or "52k jobs"
export function missSize(series: string, v: number): string {
  if (UNIT[series] === "jobs") return `${Math.round(v / 1000)}k jobs`;
  return `${v.toFixed(2)} pp`;
}

// share of PIT values in the outer tenths (below 0.1 or above 0.9); 20% when calibrated
export function tailShare(hist: number[]): number | null {
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0 || hist.length < 2) return null;
  return ((hist[0] ?? 0) + (hist[hist.length - 1] ?? 0)) / total;
}

export function scoreFinding(series: string, label: string, s: SeriesScores): string {
  const parts: string[] = [];
  const previous = PREVIOUS[seriesKind(series)];
  if (s.skill !== null && s.mae_market !== null && s.mae_naive !== null) {
    const pct = Math.round(Math.abs(s.skill) * 100);
    parts.push(
      s.skill > 0
        ? `The market's median beat simply repeating ${previous}: its typical miss was ${missSize(series, s.mae_market)}, against ${missSize(series, s.mae_naive)}, ${pct}% smaller.`
        : `Simply repeating ${previous} did as well or better than the market's median: typical misses of ${missSize(series, s.mae_naive)} against ${missSize(series, s.mae_market)}.`,
    );
  }
  const tails = tailShare(s.pit_hist);
  if (tails !== null) {
    const share = `${Math.round(tails * 100)}%`;
    if (tails > 0.3) {
      parts.push(`The real number often landed in the far ends of the odds: ${share} of ${label} releases fell in the outer tenths, against 20% for a calibrated market.`);
    } else if (tails < 0.12) {
      parts.push(`The real number rarely reached the far ends of the odds (${share} in the outer tenths, against 20% ideal), so the market's ranges were wider than needed.`);
    } else {
      parts.push(`Outcomes spread across the market's odds about as a calibrated market would (${share} in the outer tenths, against 20%).`);
    }
  }
  return parts.join(" ");
}
