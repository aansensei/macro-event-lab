import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import { ReleaseFile } from "./ReleaseFile";

const arena: Arena = {
  schema_version: 1, information_date: "2026-01-01",
  targets: [
    { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
    { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
  ],
  contestants: [
    { id: "a", label: "Fixture A", kind: "baseline", note: "" },
    { id: "b", label: "Fixture B", kind: "classical", note: "" },
  ],
  forecasts: [
    { target: "gdp", period: "2020-04-01", made_on: "2020-05-01", actual: -10, values: { a: 1, b: 2 }, intervals: {} },
  ],
  scores: [], leakage: [], live: [],
};
const revisions: Revisions = {
  schema_version: 1, settled_months: 24,
  series: [{
    series: "gdp", label: "GDP", unit: "points", resolution: 0.1, latest_vintage: "2026-01-01", n: 1,
    mean_revision: null, mean_abs_revision: null, mean_abs_next: null, share_up: null, share_down: null,
    mean_abs_first: null, biggest: [],
    points: [{ period: "2020-04-01", first: -10, next: null, latest: -8, settled: true }],
  }],
};

describe("ReleaseFile", () => {
  it("shows the three steps with values built from the data and only targets that have a usable release", () => {
    const html = renderToStaticMarkup(createElement(ReleaseFile, { arena, revisions }));
    expect(html).toContain("The release file");
    expect(html).toContain("Fixture A");
    expect(html).toContain("−10.0% annualized");
    expect(html).toContain("−8.0% annualized");
    expect(html).toContain("GDP growth");
    expect(html).not.toContain("Inflation");
    expect(html).toContain("aria-live=\"polite\"");
  });

  it("renders nothing when no target has a usable release", () => {
    const empty = renderToStaticMarkup(createElement(ReleaseFile, { arena: { ...arena, forecasts: [] }, revisions }));
    expect(empty).toBe("");
  });
});
