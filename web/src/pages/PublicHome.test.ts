// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadArena, type Arena } from "../data/arena";
import { loadBriefing, type Briefing } from "../data/briefing";
import { loadRevisions } from "../data/load";
import { loadNowcast, type Nowcast } from "../data/nowcast";
import type { Revisions } from "../data/types";
import { PublicHome } from "./PublicHome";

vi.mock("../data/arena", () => ({ loadArena: vi.fn() }));
vi.mock("../data/briefing", () => ({ loadBriefing: vi.fn() }));
vi.mock("../data/load", () => ({ loadRevisions: vi.fn() }));
vi.mock("../data/nowcast", () => ({
  loadNowcast: vi.fn(),
  nowcastErrors: () => ({ model: 1.1, naive: 2.2, n: 10 }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

const ARENA: Arena = {
  schema_version: 1,
  information_date: "2026-11-24",
  targets: [{ id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" }],
  contestants: [{ id: "naive", label: "Naive", kind: "baseline", note: "Previous print" }],
  forecasts: [{ target: "gdp", period: "2026-07-01", made_on: "2026-10-20", actual: 2.8, values: { naive: 2.5 }, intervals: {} }],
  scores: [{ target: "gdp", contestant: "naive", window: "all", n: 10, mae: 1.0, rmse: 1.5, coverage_90: null, dm_vs_naive_p: null }],
  leakage: [],
  live: [],
};

const BRIEFING: Briefing = {
  schema_version: 1,
  information_date: "2026-11-24",
  releases: [{
    target: "payrolls",
    label: "Payrolls",
    unit: "thousands of jobs",
    period: "2026-11-01",
    release_date: "2026-12-04",
    release_ts_utc: "2026-12-04T13:30:00Z",
    forecasts: [],
    last_first_print: null,
  }],
};

// only the fields the home page reads are filled in
const REVISIONS = {
  schema_version: 1,
  settled_months: 24,
  series: [{
    series: "payrolls",
    latest_vintage: "2026-10-02",
    n: 1,
    mean_abs_revision: 12,
    points: [{ period: "2024-01-01", first: 100, next: null, latest: 112, settled: true }],
  }],
} as unknown as Revisions;

const NOWCAST: Nowcast = {
  source: "ALFRED",
  schema_version: 1,
  points: [],
  coefficients: [],
  live: { reference_period: "2026-10-01", as_of: "2026-11-24", nowcast: 2.4, months_published: 1, missing: [] },
};

beforeEach(() => {
  vi.mocked(loadArena).mockResolvedValue(ARENA);
  vi.mocked(loadBriefing).mockResolvedValue(BRIEFING);
  vi.mocked(loadRevisions).mockResolvedValue(REVISIONS);
  vi.mocked(loadNowcast).mockResolvedValue(NOWCAST);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("places Explore more after Next releases and before The wider record without Try it", async () => {
  await act(async () => root.render(createElement(PublicHome)));
  const headings = [...host.querySelectorAll("h2")].map((h) => h.textContent);
  const nextIndex = headings.indexOf("Next releases");
  const exploreIndex = headings.indexOf("Explore more");
  const recordIndex = headings.indexOf("One release is a story. A history is a test.");
  expect(nextIndex).toBeGreaterThan(-1);
  expect(exploreIndex).toBeGreaterThan(nextIndex);
  expect(recordIndex).toBeGreaterThan(exploreIndex);
  expect(host.textContent).not.toContain("Try it: beat the forecasters");
});
