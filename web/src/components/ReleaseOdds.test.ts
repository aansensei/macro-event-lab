import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import type { Contestant, LiveForecastRow } from "../data/arena";
import { ReleaseOdds } from "./ReleaseOdds";

const CONTESTANTS: Contestant[] = [
  { id: "naive", label: "Naive", kind: "baseline", note: "" },
  { id: "ar", label: "Autoregression", kind: "classical", note: "" },
];
// the distribution runs from 0 at probability 0.05 to 180 at probability 0.95, so its middle is 90
const SPREAD = Array.from({ length: 19 }, (_, i) => i * 10);
const ROW: LiveForecastRow = { target: "payrolls", period: "2026-11-01", as_of: "2026-11-25", values: { naive: 90 }, quantiles: { naive: SPREAD, ar: SPREAD.map((v) => v + 10) } };

it("shows five round levels with the middle one pressed and one bar per contestant that has quantiles", () => {
  const html = renderToStaticMarkup(createElement(ReleaseOdds, { row: ROW, contestants: CONTESTANTS, unit: "thousand jobs" }));
  expect(html).toContain("Chance the number comes out above a level (thousand jobs)");
  expect(html.match(/<button/g)).toHaveLength(5);
  expect(html).toMatch(/aria-pressed="true"[^>]*>100</);
  expect(html).toContain("Naive");
  expect(html).toContain("Autoregression");
  expect(html).toContain("not a market price");
});

it("reads the chance of the pressed level from each contestant's quantiles", () => {
  const html = renderToStaticMarkup(createElement(ReleaseOdds, { row: ROW, contestants: CONTESTANTS, unit: "thousand jobs" }));
  // above 100 for the naive spread: 100 is the 55 percent quantile, so 45 percent lies above it
  expect(html).toContain("45%");
  // the autoregression spread is 10 higher, so 100 is its 50 percent quantile and 50 percent lies above
  expect(html).toContain("50%");
});

it("renders nothing when no contestant has quantiles", () => {
  const bare: LiveForecastRow = { ...ROW, quantiles: undefined };
  expect(renderToStaticMarkup(createElement(ReleaseOdds, { row: bare, contestants: CONTESTANTS, unit: "x" }))).toBe("");
});
