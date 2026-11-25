import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import type { Page } from "./url";

export const MIN_HEADLINE_OBSERVATIONS = 20;

export const BANNED_COMPARISON_WORDS = ["best", "winner", "wins", "beats", "loses", "ranks"] as const;

export interface HeadlineCard {
  id: "revisions" | "gdp-comparison" | "uncertainty";
  figure: string;
  sentence: string;
  caveat: string;
  page: Page;
}

export interface GdpComparisonStats {
  n: number;
  spfRmse: number;
  naiveRmse: number;
}

// mean absolute revision of payrolls in thousands of jobs, rounded to a whole number
export function payrollsRevisionCard(revisions: Revisions | null): HeadlineCard | null {
  const payrolls = revisions?.series.find((s) => s.series === "payrolls");
  if (!payrolls || payrolls.mean_abs_revision === null || !Number.isFinite(payrolls.mean_abs_revision)) return null;
  if (payrolls.n < MIN_HEADLINE_OBSERVATIONS) return null;
  const thousands = Math.round(payrolls.mean_abs_revision / 1000);
  return {
    id: "revisions",
    figure: `${thousands.toLocaleString("en-US")} thousand jobs`,
    sentence: "On average a payrolls figure changes by this much between its first publication and today.",
    caveat: `Across ${payrolls.n.toLocaleString("en-US")} months.`,
    page: "revisions",
  };
}

// root mean squared error of the survey median and naive forecast on common GDP quarters
export function gdpComparisonErrors(arena: Arena | null): GdpComparisonStats | null {
  if (!arena) return null;
  let spfSquared = 0;
  let naiveSquared = 0;
  let n = 0;
  for (const row of arena.forecasts) {
    if (row.target !== "gdp" || row.actual === null || !Number.isFinite(row.actual)) continue;
    const spf = row.values.spf;
    const naive = row.values.naive;
    if (spf === null || spf === undefined || !Number.isFinite(spf)) continue;
    if (naive === null || naive === undefined || !Number.isFinite(naive)) continue;
    spfSquared += (row.actual - spf) ** 2;
    naiveSquared += (row.actual - naive) ** 2;
    n += 1;
  }
  if (n === 0) return null;
  return { n, spfRmse: Math.sqrt(spfSquared / n), naiveRmse: Math.sqrt(naiveSquared / n) };
}

// same-period comparison card on GDP growth between the survey median and the naive forecast
export function gdpComparisonCard(arena: Arena | null): HeadlineCard | null {
  const stats = gdpComparisonErrors(arena);
  if (!stats || stats.n < MIN_HEADLINE_OBSERVATIONS) return null;
  return {
    id: "gdp-comparison",
    figure: `${stats.spfRmse.toFixed(1)} and ${stats.naiveRmse.toFixed(1)} points`,
    sentence: "On GDP growth, over the same quarters, here is how far the survey and the naive forecast were from the first published number.",
    caveat: `Across ${stats.n.toLocaleString("en-US")} quarters, preliminary results.`,
    page: "arena",
  };
}

// observed share of inflation releases inside the naive 90 percent interval
export function cpiUncertaintyCard(arena: Arena | null): HeadlineCard | null {
  const row = arena?.calibration?.find(
    (entry) => entry.target === "cpi" && entry.contestant === "naive" && Math.abs(entry.level - 0.9) < 1e-9,
  );
  if (!row || row.n < MIN_HEADLINE_OBSERVATIONS || !Number.isFinite(row.coverage)) return null;
  const percent = Math.round(row.coverage * 100);
  return {
    id: "uncertainty",
    figure: `${percent}%`,
    sentence: "A forecast range that promises 90 percent held the real inflation number about this often.",
    caveat: `Across ${row.n.toLocaleString("en-US")} releases.`,
    page: "arena",
  };
}

// collect the headline cards whose data meet the minimum observation count
export function headlineCards(arena: Arena | null, revisions: Revisions | null): HeadlineCard[] {
  return [
    payrollsRevisionCard(revisions),
    gdpComparisonCard(arena),
    cpiUncertaintyCard(arena),
  ].filter((card): card is HeadlineCard => card !== null);
}
