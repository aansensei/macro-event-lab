import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import type { Page } from "./url";

export interface PublicFinding { title: string; value: string; detail: string; page: Page }

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

// three plain numbers drawn from the public files, each linking to the page that holds the evidence
export function publicFindings(arena: Arena | null, revisions: Revisions | null): PublicFinding[] {
  const jobs = revisions?.series.find((s) => s.series === "payrolls");
  const scores = arena?.scores.filter((s) => s.target === "gdp" && s.window === "all") ?? [];
  const naive = scores.find((s) => s.contestant === "naive" && s.rmse !== null);
  const others = scores.filter((s) => s.contestant !== "naive" && s.rmse !== null);
  const covered = scores.map((s) => s.coverage_90).filter((v): v is number => v !== null);
  return [
    {
      title: "The answer can change",
      page: "revisions",
      value: jobs?.mean_abs_revision == null ? "Not available" : `${Math.round(jobs.mean_abs_revision).toLocaleString("en-US")} jobs`,
      detail: jobs?.mean_abs_revision == null ? "Jobs revision size is not available in this dataset."
        : `Average absolute revision across ${jobs.n} jobs reports at least ${revisions!.settled_months} months old. Source: ALFRED.`,
    },
    {
      title: "Against the simple guess",
      page: "arena",
      value: naive && others.length ? `${others.filter((s) => s.rmse! < naive.rmse!).length} of ${others.length}` : "Not available",
      detail: naive && others.length
        ? `GDP forecasters and models with a lower RMSE than repeating the previous first print, over ${naive.n} quarters. Preliminary.`
        : "GDP scores are not available in this dataset.",
    },
    {
      title: "How often the range held",
      page: "arena",
      value: covered.length ? `${Math.round(100 * medianOf(covered))}%` : "Not available",
      detail: covered.length
        ? `Median share of GDP first prints inside the 90% interval, across ${covered.length} contestants with intervals. A well calibrated 90% range holds about nine times in ten.`
        : "Interval coverage is not available in this dataset.",
    },
  ];
}
