// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import type { ArenaForecast } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import { ArenaChart } from "./ArenaChart";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("marks clipped values, preserves missing-line gaps and supports pointer inspection", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const points: ArenaForecast[] = Array.from({ length: 100 }, (_, index) => ({
    target: "gdp", period: `${1950 + Math.floor(index / 4)}-${String(index % 4 * 3 + 1).padStart(2, "0")}-01`,
    made_on: "2025-01-01", actual: index === 99 ? 100 : 1,
    values: { "fixture-b": index === 50 ? null : 1 }, intervals: {},
  }));
  try {
    await act(async () => root.render(createElement(ArenaChart, {
      target: arenaFixture.targets[0]!, contestant: arenaFixture.contestants[1], points,
    })));
    expect(host.querySelectorAll('[data-clipped="true"]')).toHaveLength(1);
    expect(host.querySelector(".arena-readout")?.textContent).toContain("First print 100.00");
    expect(host.querySelector('[data-series="forecast"]')?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    const chart = host.querySelector<SVGSVGElement>('svg[role="img"]')!;
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 520, 300));
    await act(async () => chart.dispatchEvent(new PointerEvent("pointerdown", { clientX: 54, bubbles: true })));
    expect(host.querySelector(".arena-readout")?.textContent).toContain("Q1 1950");
    await act(async () => chart.dispatchEvent(new PointerEvent("pointermove", { clientX: 504, bubbles: true })));
    expect(host.querySelector(".arena-readout")?.textContent).toContain("First print 100.00");
    expect(host.querySelector(".arena-interval")).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks();
  }
});
