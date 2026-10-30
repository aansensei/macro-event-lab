// @vitest-environment happy-dom
import { act, createElement, createRef, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { loadEvent } from "../data/load";
import type { EventFile, ManifestEvent, Snapshot } from "../data/types";
import { Explorer } from "./Explorer";

vi.mock("../data/load", () => ({ loadEvent: vi.fn() }));
vi.mock("../hooks/useWidth", () => ({ useWidth: () => [createRef(), 640] }));
vi.mock("../hooks/useCountUp", () => ({ useCountUp: (value: number) => value }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const entry: ManifestEvent = {
  id: "cached-hour-fixture", event_ticker: "FIXTURE", series: "KXCPI", title: "CPI fixture", unit: "%",
  close: "2025-01-15T13:30:00Z", release_date: "2025-01-15", first_print: 0.2,
  surprise: 0, surprise_sd: 0, file: "fixture.json", n_snapshots: 2, strikes: 3,
};
const snapshot: Snapshot = {
  h: 24, ts: "2025-01-14T13:00:00Z", mean: 0.2, sd: 0.1,
  p05: 0.1, p25: 0.1, p50: 0.2, p75: 0.3, p95: 0.3,
  bins: [[0.05, 0.15, 0.25], [0.15, 0.25, 0.5], [0.25, 0.35, 0.25]],
  survival: [[0.1, 0.75, 0.75], [0.2, 0.25, 0.25]],
};
const event: EventFile = {
  schema_version: 1, id: entry.id, event_ticker: entry.event_ticker, series: entry.series,
  title: entry.title, unit: entry.unit, resolution: 0.1, close: entry.close,
  release_date: entry.release_date, reference_period: "2024-12-01", first_print: 0.2,
  first_print_source: "alfred", match_method: "reference_period", settled_value: 0.2,
  surprise: 0, surprise_sd: 0, reaction: { date: "2025-01-15", prev_date: "2025-01-14", dgs2_bp: 7, dgs10_bp: -5 }, insight: null,
  snapshots: [snapshot, { ...snapshot, h: 1, ts: "2025-01-15T12:00:00Z" }],
};

it("keeps a linked hour when a cached event remounts under StrictMode", async () => {
  vi.mocked(loadEvent).mockResolvedValue(event);
  const onHourChange = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const tree = createElement(StrictMode, null, createElement(Explorer, {
    entry, dataThrough: "2025-01-15", initialHour: 24, onHourChange,
  }));
  try {
    await act(async () => root.render(tree));
    expect(onHourChange).toHaveBeenLastCalledWith(24);
    const fetches = vi.mocked(loadEvent).mock.calls.length;
    await act(async () => root.render(null));
    onHourChange.mockClear();
    await act(async () => root.render(tree));
    expect(loadEvent).toHaveBeenCalledTimes(fetches);
    expect(onHourChange).toHaveBeenLastCalledWith(24);
    expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("-24");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});

it("hides outcomes throughout the detail, including SVG markers and open data tables", async () => {
  vi.mocked(loadEvent).mockResolvedValue(event);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onHourChange = vi.fn();
  const onRevealChange = vi.fn();
  try {
    await act(async () => root.render(createElement(Explorer, {
      entry, dataThrough: "2025-01-15", initialHour: 24, onHourChange, revealStage: 0, onRevealChange,
    })));
    expect(host.querySelector(".val-actual")).toBeNull();
    expect(host.querySelector(".val-surprise-up")).toBeNull();
    expect(host.querySelector('.key-label')?.textContent).toContain("T−24h");
    expect(host.querySelector(".plain-words")?.textContent).toContain("selected market snapshot");
    expect(host.querySelector(".plain-words")?.textContent).not.toContain("The official number");
    expect(host.querySelector('svg [stroke="var(--actual)"]')).toBeNull();
    expect(host.querySelector(".reaction-block")).toBeNull();
    const tableButtons = [...host.querySelectorAll<HTMLButtonElement>("button")].filter(b => b.textContent === "Show data table");
    for (const button of tableButtons) await act(async () => button.click());
    expect(host.querySelector(".mel-table")?.textContent).not.toContain("(first print)");
    await act(async () => root.render(createElement(Explorer, {
      entry, dataThrough: "2025-01-15", initialHour: 24, onHourChange, revealStage: 1, onRevealChange,
    })));
    expect(host.querySelector(".val-actual")).not.toBeNull();
    expect(host.querySelector('svg [stroke="var(--actual)"]')).not.toBeNull();
    expect(host.querySelector(".reaction-block")).toBeNull();
    expect(host.querySelector(".plain-words")?.textContent).not.toContain("On release day");
    expect(host.querySelector(".key-strip")?.textContent).not.toContain("Release day:");
    await act(async () => root.render(createElement(Explorer, {
      entry, dataThrough: "2025-01-15", initialHour: 24, onHourChange, revealStage: 2, onRevealChange,
    })));
    expect(host.querySelector(".reaction-block")).not.toBeNull();
    expect(host.querySelector(".key-strip")?.textContent).toContain("Release day:");
    expect(host.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe("-24");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
