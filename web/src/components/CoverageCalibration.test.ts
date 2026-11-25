import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { ArenaTarget, CalibrationRow, Contestant } from "../data/arena";
import { CoverageCalibration } from "./CoverageCalibration";

const TARGET = { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" } as unknown as ArenaTarget;
const CONTESTANTS: Contestant[] = [
  { id: "naive", label: "Naive", kind: "baseline", note: "" },
  { id: "ar", label: "Autoregression", kind: "classical", note: "" },
];
const rows = (level: number, coverage: number): CalibrationRow[] => [
  { target: "cpi", contestant: "naive", level, n: 100, coverage, coverage_lo: coverage - 0.1, coverage_hi: coverage + 0.05 },
];

it("lists each promised level with the observed share, its range and the number of releases", () => {
  const html = renderToStaticMarkup(createElement(CoverageCalibration, {
    rows: [...rows(0.5, 0.52), ...rows(0.8, 0.77), ...rows(0.9, 0.9)], contestants: CONTESTANTS, target: TARGET,
  }));
  expect(html).toContain("Do the intervals mean what they say?");
  expect(html).toContain("Promised 50%");
  expect(html).toContain("Promised 90%");
  expect(html).toContain("52%");
  expect(html).toContain("42% to 57%, 100 releases");
  expect(html).toContain("Naive");
  expect(html).not.toContain("Autoregression");
});

it("shows Not available for a missing level and renders nothing for a target without rows", () => {
  const partial = renderToStaticMarkup(createElement(CoverageCalibration, { rows: rows(0.9, 0.9), contestants: CONTESTANTS, target: TARGET }));
  expect(partial).toContain("Not available");
  const other = { ...TARGET, id: "gdp" } as unknown as ArenaTarget;
  expect(renderToStaticMarkup(createElement(CoverageCalibration, { rows: rows(0.9, 0.9), contestants: CONTESTANTS, target: other }))).toBe("");
});
