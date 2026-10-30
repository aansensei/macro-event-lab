import type { Revisions, Summary } from "../data/types";

export function revisionHook(revisions: Revisions) {
  const jobs = revisions.series.find((s) => s.series === "KXPAYROLLS");
  const point = jobs?.points.filter((p) => p.settled && p.latest !== null && p.latest > p.first)
    .sort((a, b) => ((b.latest as number) - b.first) - ((a.latest as number) - a.first)
      || a.period.localeCompare(b.period))[0];
  if (!jobs || !point || point.latest === null) return null;
  return { period: point.period, first: point.first, latest: point.latest, vintage: jobs.latest_vintage };
}

export function overviewFindings(summary: Summary, revisions: Revisions) {
  const cpi = summary.series.find((s) => s.series === "KXCPI");
  const jobs = revisions.series.find((s) => s.series === "KXPAYROLLS");
  return [
    { title: "How often the range held", value: cpi?.hit_90 == null ? "Not available" : `${Math.round(cpi.hit_90 * 100)}%`,
      detail: cpi?.hit_90 == null ? "CPI coverage is not available in this dataset."
        : `Share of CPI first prints inside the market's 90% range at T-1h, across ${cpi.n} CPI reports.` },
    { title: "CPI forecast accuracy", value: cpi?.scores?.skill == null ? "Not available" : `${Math.round(cpi.scores.skill * 100)}%`,
      detail: cpi?.scores?.skill == null ? "CPI forecast skill is not available in this dataset."
        : `Reduction in average absolute error versus repeating the previous print, across ${cpi.scores.n} CPI reports. Negative means worse.` },
    { title: "The answer can change", value: jobs?.mean_abs_revision == null ? "Not available"
        : `${Math.round(jobs.mean_abs_revision).toLocaleString("en-US")} jobs`,
      detail: jobs?.mean_abs_revision == null ? "Jobs revision size is not available in this dataset."
        : `Average absolute revision across ${jobs.n} jobs reports at least ${revisions.settled_months} months old. Source: ALFRED.` },
  ];
}
