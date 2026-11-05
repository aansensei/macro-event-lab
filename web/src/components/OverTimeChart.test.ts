// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { Snapshot } from "../data/types";
import { FanChart, OddsChart } from "./OverTimeChart";

vi.mock("../hooks/useWidth", () => ({ useWidth: () => [createRef(), 640] }));
vi.mock("../hooks/useTween", () => ({ useTween: (values: number[]) => values }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
const s: Snapshot = { h: 4, ts: "2026-01-01T10:00:00Z", mean: 0.2, sd: 0.1,
  p05: 0, p25: 0.1, p50: 0.2, p75: 0.3, p95: 0.4, bins: [[null, 0.2, 0.3], [0.2, null, 0.7]], survival: [] };
const snaps = [s, { ...s, h: 1, ts: "2026-01-01T13:00:00Z" }];
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("draws isolated fan observations without connecting across a missing hour", async () => {
  await act(async () => root.render(createElement(FanChart, {
    snaps, h: 1, maxH: 4, minH: 1, unit: "%", firstPrint: null, onHour: vi.fn(),
  })));
  const lines = [...host.querySelectorAll('polyline[stroke="var(--median)"]')];
  expect(lines).toHaveLength(2);
  expect(lines.every(line => line.getAttribute("points")!.split(" ").length === 1)).toBe(true);
  expect(host.querySelectorAll('circle[fill="var(--median)"]')).toHaveLength(3);
  expect(host.querySelector('[stroke="var(--actual)"]')).toBeNull();
});

it("breaks outcome lines at unrecorded hours and shows isolated observations", async () => {
  await act(async () => root.render(createElement(OddsChart, {
    snaps, h: 1, maxH: 4, minH: 1, unit: "%", resolution: 0.1, onHour: vi.fn(),
  })));
  const lines = [...host.querySelectorAll("polyline")];
  expect(lines).toHaveLength(4);
  expect(lines.every(line => line.getAttribute("points")!.split(" ").length === 1)).toBe(true);
  expect(host.querySelectorAll("circle")).toHaveLength(4);
});

it("keeps keyboard scrubbing within recorded time bounds", async () => {
  const change = vi.fn();
  await act(async () => root.render(createElement(FanChart, {
    snaps, h: 1, maxH: 4, minH: 1, unit: "%", firstPrint: null, onHour: change,
  })));
  const slider = host.querySelector<SVGElement>('[role="slider"]')!;
  for (const key of ["ArrowRight", "Home", "End"]) {
    await act(async () => slider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
  }
  expect(change.mock.calls.map(([h]) => h)).toEqual([1, 4, 1]);
  expect(slider.getAttribute("aria-valuetext")).toBe("1 hour before the market close hour, Jan 1 08:00 ET");
});
