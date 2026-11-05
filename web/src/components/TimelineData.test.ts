// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { Snapshot } from "../data/types";
import { TimelineData } from "./TimelineData";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const snapshot: Snapshot = { h: 1, ts: "2026-10-14T11:00:00Z", mean: 0.2, sd: 0.1,
  p05: 0, p25: 0.1, p50: 0.2, p75: 0.3, p95: 0.4,
  bins: [[null, 0.2, 0], [0.2, null, 1]], survival: [] };
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("opens the actual timestamps and quantiles without mounting the table beforehand", async () => {
  await act(async () => root.render(createElement(TimelineData, { snapshots: [snapshot], odds: false, unit: "%", resolution: 0.1 })));
  expect(host.querySelector("table")).toBeNull();
  const button = host.querySelector<HTMLButtonElement>("button")!;
  await act(async () => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector("time")?.getAttribute("datetime")).toBe(snapshot.ts);
  expect(host.querySelector("tbody")?.textContent).toContain("0.00% to 0.40%");
  expect(host.querySelector("tbody")?.textContent).toContain("0.20%");
  expect(host.textContent).not.toContain("first print");
  expect(host.querySelector('[role="region"]')?.getAttribute("tabindex")).toBe("0");
  await act(async () => button.click());
  expect(host.querySelector("table")).toBeNull();
});

it("preserves zero odds and marks absent probabilities unavailable", async () => {
  const snapshots = [snapshot, { ...snapshot, h: 0, ts: "2026-10-14T12:00:00Z", bins: [[null, 0.2, 1]] as Snapshot["bins"] }];
  await act(async () => root.render(createElement(TimelineData, { snapshots, odds: true, unit: "%", resolution: 0.1 })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  const rows = host.querySelectorAll("tbody tr");
  expect(rows).toHaveLength(2);
  expect(rows[0]?.textContent).toContain("0.0%");
  expect(rows[1]?.textContent).toContain("Unavailable");
});

it("distinguishes missing ranges from zero and keeps jobs in full display units", async () => {
  await act(async () => root.render(createElement(TimelineData, {
    snapshots: [{ ...snapshot, p50: 10234, p25: null, p95: null }], odds: false, unit: "jobs", resolution: 1000,
  })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  const cells = [...host.querySelectorAll("tbody td")].map(c => c.textContent);
  expect(cells).toContain("10,234 jobs");
  expect(cells.filter(c => c === "Unavailable")).toHaveLength(2);
});

it("explains an empty timeline instead of adding synthetic rows", async () => {
  await act(async () => root.render(createElement(TimelineData, { snapshots: [], odds: false, unit: null, resolution: null })));
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(host.textContent).toContain("No recorded snapshots");
});
