import { expect, it } from "vitest";

import type { Arena, ArenaScore } from "../data/arena";
import type { Revisions } from "../data/types";
import { publicFindings } from "./publicFindings";

function score(contestant: string, rmse: number | null, coverage: number | null): ArenaScore {
  return { target: "gdp", contestant, window: "all", n: 40, mae: 1, rmse, coverage_90: coverage, dm_vs_naive_p: null } as ArenaScore;
}
const arena = {
  scores: [score("naive", 4, null), score("a", 3, 0.8), score("b", 5, 0.9), score("c", 2, 0.95), score("d", null, null)],
} as unknown as Arena;
const revisions = {
  settled_months: 24,
  series: [
    { series: "gdp", n: 99, mean_abs_revision: 1.188 },
    { series: "cpi", n: 298, mean_abs_revision: 0.083 },
  ],
} as unknown as Revisions;

it("reports GDP and CPI revisions and counts contestants below naive RMSE without repeating headline cards", () => {
  const [gdpRev, beat, cpiRev] = publicFindings(arena, revisions);
  expect(gdpRev?.value).toBe("1.2 points");
  expect(gdpRev?.page).toBe("revisions");
  expect(beat?.value).toBe("2 of 3");
  expect(beat?.detail).toContain("40 quarters");
  expect(cpiRev?.value).toBe("0.08 points");
  expect(cpiRev?.page).toBe("revisions");
});

it("reports every finding as not available when the data have not loaded", () => {
  expect(publicFindings(null, null).map((f) => f.value)).toEqual(["Not available", "Not available", "Not available"]);
});
