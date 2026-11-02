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
  latest_vintage: "2026-10-02", n: 1, mean_abs_revision: 10,
  points: [{ period: "2025-01-01", first: 10, latest: 20, settled: true }] }] } as Revisions;

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
  const cards = host.querySelectorAll(".overview-findings article");
  expect(cards[0]?.querySelector(".finding-value")).toBeNull();
  expect(cards[1]?.querySelector(".finding-value")).toBeNull();
  expect(cards[2]?.textContent).toContain("10 jobs");
  expect(host.querySelector(".revision-reveal")).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(host.querySelector(".event-reveal")).not.toBeNull();
  expect(loadSummary).toHaveBeenCalledTimes(2);
  expect(loadRevisions).toHaveBeenCalledOnce();
});

it("keeps the market hook when revisions fail and retries only revisions", async () => {
  vi.mocked(loadRevisions).mockRejectedValueOnce(new Error("Revisions unavailable"));
  await act(async () => root.render(createElement(Overview)));
  expect(host.querySelector(".event-reveal")).not.toBeNull();
  expect(host.querySelector(".overview-revisions [role='alert']")?.textContent).toContain("Revisions unavailable");
  await act(async () => host.querySelector<HTMLButtonElement>(".overview-revisions button")!.click());
  expect(host.querySelector(".revision-reveal")).not.toBeNull();
  expect(loadSummary).toHaveBeenCalledOnce();
  expect(loadRevisions).toHaveBeenCalledTimes(2);
});

it("shows the release hook while the independent revision source is still pending", async () => {
  let finish!: (value: Revisions) => void;
  vi.mocked(loadRevisions).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await act(async () => root.render(createElement(Overview)));
  expect(host.querySelector(".event-reveal")).not.toBeNull();
  expect(host.querySelector(".overview-revisions [role='status']")?.textContent).toBe("Loading the revision example");
  await act(async () => finish(revisions));
  expect(host.querySelector(".revision-reveal")).not.toBeNull();
  expect(loadManifest).not.toHaveBeenCalled();
});
