// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadManifest, loadRevisions, loadSummary } from "../data/load";
import type { Revisions, Summary } from "../data/types";
import { Overview } from "./Overview";

vi.mock("../data/load", () => ({ loadSummary: vi.fn(), loadRevisions: vi.fn(), loadManifest: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const summary = { schema_version: 1, series: [], points: [{ id: "cpi-fixture", series: "KXCPI", title: "CPI fixture",
  surprise_sd: 2, dgs2_bp: 4, dgs10_bp: null, in_50: false, in_90: false }] } as Summary;
const revisions = { schema_version: 1, settled_months: 24, series: [{ series: "KXPAYROLLS",
  latest_vintage: "2026-10-02", points: [{ period: "2025-01-01", first: 10, latest: 20, settled: true }] }] } as Revisions;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadSummary).mockResolvedValue(summary);
  vi.mocked(loadRevisions).mockResolvedValue(revisions);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("keeps the release hook first, evidence and story next, and revisions and instructions later", async () => {
  await act(async () => root.render(createElement(Overview)));
  const sections = [...host.querySelectorAll(".overview-intro, .overview-page > section")];
  expect(sections[0]?.querySelector(".event-reveal")).not.toBeNull();
  expect(sections[1]?.getAttribute("aria-labelledby")).toBe("overview-findings");
  expect(sections[2]?.className).toBe("overview-story");
  expect(sections[3]?.className).toBe("overview-revisions");
  expect(sections[4]?.id).toBe("overview-guide");
  expect(loadSummary).toHaveBeenCalledOnce();
  expect(loadRevisions).toHaveBeenCalledOnce();
  expect(loadManifest).not.toHaveBeenCalled();
  expect(host.querySelector(".event-reveal-actions a")?.getAttribute("href")).toBe("?event=cpi-fixture&h=1&reveal=0");
  expect(host.querySelectorAll(".story-card")).toHaveLength(4);
});

it("shows a source error and leaves a direct path to Events without made-up results", async () => {
  vi.mocked(loadSummary).mockRejectedValueOnce(new Error("Summary unavailable"));
  await act(async () => root.render(createElement(Overview)));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Summary unavailable");
  expect(host.querySelector(".overview-secondary")?.getAttribute("href")).toBe("?page=events");
  expect(host.querySelector(".event-reveal")).toBeNull();
  expect(host.querySelector(".finding-value")).toBeNull();
});
