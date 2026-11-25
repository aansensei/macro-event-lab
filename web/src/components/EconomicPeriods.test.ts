import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { parseArena, type ArenaTarget, type RegimeScore } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import { EconomicPeriods } from "./EconomicPeriods";

const target: ArenaTarget = { id: "gdp", label: "GDP growth", unit: "percent", frequency: "quarterly" };
const row: RegimeScore = { target: "gdp", contestant: "naive", regime: "2020", n: 4, rmse: 2, mae: 2, naive_rmse: null, vs_naive_pct: null };

it("parses optional period scores with strict numeric and sample checks", () => {
  expect(parseArena(arenaFixture).regimes).toEqual([]);
  expect(parseArena({ ...arenaFixture, regimes: [row] }).regimes).toEqual([row]);
  expect(() => parseArena({ ...arenaFixture, regimes: [{ ...row, n: 3 }] })).toThrow(/four/);
  expect(() => parseArena({ ...arenaFixture, regimes: [{ ...row, regime: "unknown" }] })).toThrow(/Unknown/);
  expect(() => parseArena({ ...arenaFixture, regimes: [{ ...row, rmse: "2" }] })).toThrow(/numeric/);
});

it("renders a collapsed descriptive table with missing, thin, baseline and percent cells", () => {
  const rows = [row, { ...row, contestant: "fixture-b", vs_naive_pct: -8.1 },
    { ...row, contestant: "fixture-b", regime: "2021_2023", n: 3, rmse: null, mae: null }];
  const html = renderToStaticMarkup(createElement(EconomicPeriods, { rows, target, contestants: arenaFixture.contestants }));
  expect(html).toContain("Scores by economic period");
  expect(html).not.toContain(' open=""');
  for (const text of ["No forecast", "Too few", "Baseline", "-8%", "RMSE 2.00", "after the results were known", "fewer than 4"]) expect(html).toContain(text);
  expect(renderToStaticMarkup(createElement(EconomicPeriods, { rows: [], target, contestants: [] }))).toBe("");
});
