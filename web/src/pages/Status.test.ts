// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadStatus } from "../data/status";
import { statusFixture } from "../data/statusFixture";
import { Status } from "./Status";

vi.mock("../data/status", () => ({ loadStatus: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadStatus).mockResolvedValue(structuredClone(statusFixture));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("renders source age, actual counts, attribution and filter outcomes", async () => {
  await act(async () => root.render(createElement(Status)));
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.textContent).toContain("97 days");
  expect(host.textContent).toContain("Threshold: 120 days");
  expect(host.textContent).toContain("2 of 2");
  expect(host.textContent).toContain("Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF)");
  expect(host.textContent).not.toContain("Layout sample");
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(".check-filter button")];
  await act(async () => buttons[2]!.click());
  expect(host.querySelector('[aria-pressed="true"]')?.textContent).toContain("Warn");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Showing 1 quality check.");
  expect(host.querySelectorAll(".status-check-table tbody tr")).toHaveLength(1);
  expect(host.querySelector(".status-check-table")?.textContent).toContain("Fixture history has one gap");
  await act(async () => buttons[0]!.click());
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Showing 4 quality checks.");
});

it("shows independent empty sections and never invents passing checks", async () => {
  vi.mocked(loadStatus).mockResolvedValueOnce({ ...statusFixture, sources: [], checks: [] });
  await act(async () => root.render(createElement(Status)));
  expect(host.textContent).toContain("No source freshness records");
  expect(host.textContent).toContain("No quality check records");
  expect(host.textContent).toContain("0 of 0");
  expect(host.querySelector(".status-badge")).toBeNull();
});

it("reports empty filters and date anomalies visibly", async () => {
  vi.mocked(loadStatus).mockResolvedValueOnce({ ...statusFixture, checks: statusFixture.checks.slice(0, 2),
    sources: [{ ...statusFixture.sources[0]!, latest_vintage_date: "2026-11-22", is_fresh: false }] });
  await act(async () => root.render(createElement(Status)));
  expect(host.textContent).toContain("Date anomaly");
  expect(host.textContent).toContain("2 days after cutoff");
  await act(async () => host.querySelectorAll<HTMLButtonElement>(".check-filter button")[3]!.click());
  expect(host.textContent).toContain("No checks match this filter");
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Showing 0 quality checks.");
});

it.each(["The status snapshot has not been built yet.", "Unsupported status data version. This page reads version 1.", "The data file could not be reached."])("recovers after %s", async (message) => {
  vi.mocked(loadStatus).mockRejectedValueOnce(new Error(message));
  await act(async () => root.render(createElement("main", { tabIndex: -1 }, createElement(Status))));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(message);
  const retry = host.querySelector<HTMLButtonElement>('[role="alert"] button')!;
  retry.focus();
  await act(async () => retry.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(loadStatus).toHaveBeenCalledTimes(2);
  expect(document.activeElement).toBe(host.querySelector("main"));
});

it("announces loading without showing fixture records", async () => {
  vi.mocked(loadStatus).mockReturnValueOnce(new Promise(() => {}));
  await act(async () => root.render(createElement(Status)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading data status.");
  expect(host.textContent).not.toContain("Fixture");
});
