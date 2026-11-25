import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import type { Page } from "./url";

export interface PublicFinding { title: string; value: string; detail: string; page: Page }

// three plain numbers drawn from the public files, each distinct from the headline strip
export function publicFindings(arena: Arena | null, revisions: Revisions | null): PublicFinding[] {
  const gdpRev = revisions?.series.find((s) => s.series === "gdp");
  const cpiRev = revisions?.series.find((s) => s.series === "cpi");
  const scores = arena?.scores.filter((s) => s.target === "gdp" && s.window === "all") ?? [];
  const naive = scores.find((s) => s.contestant === "naive" && s.rmse !== null);
  const others = scores.filter((s) => s.contestant !== "naive" && s.rmse !== null);
  return [
    {
      title: "GDP revisions",
      page: "revisions",
      value: gdpRev?.mean_abs_revision == null ? "Not available" : `${gdpRev.mean_abs_revision.toFixed(1)} points`,
      detail: gdpRev?.mean_abs_revision == null ? "GDP revision size is not available in this dataset."
        : `Average absolute revision across ${gdpRev.n} GDP releases at least ${revisions!.settled_months} months old. Source: ALFRED.`,
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
      title: "Inflation revisions",
      page: "revisions",
      value: cpiRev?.mean_abs_revision == null ? "Not available" : `${cpiRev.mean_abs_revision.toFixed(2)} points`,
      detail: cpiRev?.mean_abs_revision == null ? "CPI revision size is not available in this dataset."
        : `Average absolute revision across ${cpiRev.n} CPI reports at least ${revisions!.settled_months} months old. Source: ALFRED.`,
    },
  ];
}
