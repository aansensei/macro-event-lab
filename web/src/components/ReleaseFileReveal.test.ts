// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import { ReleaseFile } from "./ReleaseFile";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const arena: Arena = {
  schema_version: 1, information_date: "2026-01-01",
  targets: [{ id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" }],
  contestants: [
    { id: "a", label: "Fixture A", kind: "baseline", note: "" },
    { id: "b", label: "Fixture B", kind: "classical", note: "" },
  ],
  forecasts: [{ target: "gdp", period: "2020-04-01", made_on: "2020-05-01", actual: -10, values: { a: 1, b: 2 }, intervals: {} }],
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
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("reveals the first published number, then today's figure, then starts again", async () => {
  await act(async () => root.render(createElement(ReleaseFile, { arena, revisions })));
  const button = () => host.querySelector<HTMLButtonElement>(".release-reveal")!;
  expect(host.textContent).not.toContain("−10.0");
  await act(async () => button().click());
  expect(host.textContent).toContain("−10.0% annualized");
  expect(host.textContent).not.toContain("−8.0% annualized");
  expect(button().textContent).toBe("Show what it became");
  await act(async () => button().click());
  expect(host.textContent).toContain("−8.0% annualized");
  expect(button().textContent).toBe("Start again");
  await act(async () => button().click());
  expect(host.textContent).not.toContain("−10.0");
});
