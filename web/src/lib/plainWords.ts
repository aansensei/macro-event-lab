// Plain English reading of an event for people without an economics background. Every sentence is
// built from the event's own numbers and from how it compares with the rest of its series.

import type { EventFile, SurvivalPoint } from "../data/types";
import { MINUS, formatValue, seriesKind, type SeriesKind } from "./format";
import type { EventStatus } from "./snapshots";
import type { RevealStage } from "./url";

// Weaker correlations are described as a weak linear association.
const MIN_CORR = 0.3;

const SERIES_WORDS: Record<SeriesKind, string> = {
  cpi: "CPI reports",
  jobs: "jobs reports",
  gdp: "GDP reports",
  fomc: "Fed decisions",
  other: "releases",
};

// a job count to the nearest thousand: 88,500 becomes "89,000"
function roundedJobs(v: number): string {
  return (Math.round(Math.abs(v) / 1000) * 1000).toLocaleString("en-US");
}

// what the number measures, phrased for a value v: "consumer prices to rise 0.6% in one month"
function measure(kind: SeriesKind, v: number, unit: string | null): string {
  const size = formatValue(Math.abs(v), unit);
  switch (kind) {
    case "cpi":
      return `consumer prices to ${v < 0 ? "fall" : "rise"} ${size} in one month`;
    case "jobs":
      return `the economy to ${v < 0 ? "lose" : "add"} about ${roundedJobs(v)} jobs in one month`;
    case "gdp":
      return `the economy to ${v < 0 ? "shrink" : "grow"} at about ${size} a year`;
    case "fomc":
      return `the Fed to set the top of its interest rate range at ${formatValue(v, unit)}`;
    default:
      return `a value of ${formatValue(v, unit)}`;
  }
}

function outcome(kind: SeriesKind, v: number, unit: string | null): string {
  if (kind === "jobs") return `${v < 0 ? MINUS : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")} jobs`;
  return formatValue(v, unit);
}

// how far the print landed from expectations, in words, from the surprise in SD
export function closeness(sd: number): string {
  const side = sd > 0 ? "above" : "below";
  const size = Math.abs(sd);
  if (size < 0.5) return "very close to what traders expected";
  if (size < 1) return `a little ${side} what traders expected`;
  if (size < 2) return `clearly ${side} what traders expected`;
  return `far ${side} what traders expected, a big surprise`;
}

function pctWords(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function moved(bp: number): string {
  const size = Math.abs(Math.round(bp));
  if (size === 0) return "barely moved";
  return `${bp > 0 ? "rose" : "fell"} ${size} bp`;
}

const METRIC: Record<SeriesKind, string> = {
  cpi: "monthly CPI",
  jobs: "the jobs number",
  gdp: "GDP growth",
  fomc: "the Fed's upper bound",
  other: "the number",
};

// early markets listed one or two "above k" contracts: a few probabilities, but no distribution
function fewContracts(event: EventFile, kind: SeriesKind, survival: SurvivalPoint[]): string {
  const unit = event.unit;
  const y = event.first_print as number;
  const odds = (p: number) => `${Math.round(p * 100)}%`;
  if (survival.length === 1) {
    const [k, , p] = survival[0] as SurvivalPoint;
    const paidYes = y > k + 1e-9;
    const leanedYes = p > 0.5;
    return (
      `Kalshi listed only one contract for this ${kind === "fomc" ? "decision" : "release"}: whether ${METRIC[kind]} would come in above ${formatValue(k, unit)}. ` +
      `Just before trading closed, traders put that at ${odds(p)}. ` +
      `The official number came in at ${outcome(kind, y, unit)}, so the contract paid ${paidYes ? "yes" : "no"}` +
      (paidYes === leanedYes ? " and the market had leaned the right way." : ", against the market's lean.") +
      " With a single contract there is no full set of odds, so there is no median or surprise to measure."
    );
  }
  const parts = survival.map(([k, , p]) => `above ${formatValue(k, unit)} (${odds(p)})`).join(" and ");
  return (
    `Kalshi listed only ${survival.length} contracts for this ${kind === "fomc" ? "decision" : "release"}: whether ${METRIC[kind]} would come in ${parts}. ` +
    `The official number came in at ${outcome(kind, y, unit)}. With so few contracts there is no full set of odds, so there is no median or surprise to measure.`
  );
}

export function plainWords(
  event: EventFile,
  status: EventStatus,
  expectedMedian: number | null,
  survival: SurvivalPoint[] | null = null,
  revealStage: RevealStage = 2,
): string[] {
  const kind = seriesKind(event.series);
  const unit = event.unit;
  const series = SERIES_WORDS[kind];
  const paragraphs: string[] = [];
  const expected = expectedMedian === null ? null : measure(kind, expectedMedian, unit);
  if (revealStage === 0) {
    if (expected) return [`At the selected market snapshot, traders expected ${expected}. The result is hidden while you explore the odds.`];
    if (survival?.length) return [`At the selected snapshot, the listed threshold odds were ${survival.map(([k, , p]) => `above ${formatValue(k, unit)}: ${pctWords(p)}`).join("; ")}. The result is hidden.`];
    return ["There is no estimate at the selected snapshot. The result remains hidden."];
  }
  if (status === "published" && event.first_print !== null && expectedMedian === null && survival && survival.length > 0 && survival.length < 3) {
    paragraphs.push(fewContracts(event, kind, survival));
    return paragraphs;
  }

  if (status === "upcoming") {
    paragraphs.push(
      expected
        ? `This number is not out yet. Right now, traders expect ${expected}.`
        : "This number is not out yet, and the market has no clear estimate so far.",
    );
    return paragraphs;
  }
  if (status === "not_published" || event.first_print === null) {
    paragraphs.push(
      `This report has no published number in this data, so there is nothing to compare with.` +
        (expected ? ` Before it was due, traders expected ${expected}.` : ""),
    );
    return paragraphs;
  }

  const sd = event.surprise_sd;
  const first =
    (expected ? `Just before the release, traders expected ${expected}. ` : "") +
    `The official number came in at ${outcome(kind, event.first_print, unit)}` +
    (sd === null ? "." : `, ${closeness(sd)}.`);
  paragraphs.push(first);

  const ins = event.insight;
  if (ins) {
    const context: string[] = [];
    if (ins.surprise_rank_pct !== null && sd !== null) {
      context.push(
        `That surprise was bigger than ${pctWords(ins.surprise_rank_pct)} of the other ${ins.series_n - 1} ${series} in this data.`,
      );
    }
    if (ins.in_90 === false) {
      context.push("The number landed outside the range the market saw as 90% likely, which should happen only about 1 time in 10.");
    } else if (ins.in_50 === true) {
      context.push("It landed inside the market's middle range, where traders put half of their odds.");
    }
    if (ins.series_hit_90 !== null) {
      context.push(
        `Across all ${ins.series_n} ${series}, the real number fell inside the market's 90% range ${pctWords(ins.series_hit_90)} of the time; a well calibrated market would be close to 90%.`,
      );
    }
    if (context.length) paragraphs.push(context.join(" "));
  }

  const r = event.reaction;
  if (revealStage === 2 && r && r.dgs2_bp !== null && r.dgs10_bp !== null) {
    let text = `On release day, the 2-year Treasury yield ${moved(r.dgs2_bp)} and the 10-year ${moved(r.dgs10_bp)}.`;
    if (ins && sd !== null && ins.dgs2_bp_per_sd !== null && ins.dgs2_corr !== null) {
      if (Math.abs(ins.dgs2_corr) >= MIN_CORR) {
        const typical = Math.round(ins.dgs2_bp_per_sd * sd);
        text +=
          ` For ${series}, each 1 SD of surprise was associated with a 2-year yield change of about ${Math.abs(ins.dgs2_bp_per_sd).toFixed(1)} bp` +
          ` ${ins.dgs2_bp_per_sd > 0 ? "in the same direction" : "the other way"}; the fitted relationship gives about ${typical > 0 ? "+" : typical < 0 ? MINUS : ""}${Math.abs(typical)} bp for this surprise.` +
          (Math.round(r.dgs2_bp) > 0
            ? " A rising 2-year yield usually means markets expect interest rates to stay higher for longer."
            : Math.round(r.dgs2_bp) < 0
              ? " A falling 2-year yield usually means markets expect interest rates to come down sooner."
              : "");
      } else {
        text += ` For ${series}, the linear association between surprises and daily yield changes is weak.`;
      }
    }
    paragraphs.push(text + " This daily comparison does not isolate the release's effect.");
  }
  return paragraphs;
}
