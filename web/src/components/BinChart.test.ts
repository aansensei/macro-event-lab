// @vitest-environment happy-dom
import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { BinChart } from "./BinChart";
import type { Bin } from "../data/types";

vi.mock("../hooks/useWidth", () => ({ useWidth: () => [createRef(), 640] }));
vi.mock("../hooks/useTween", () => ({ useTween: (values: number[]) => values }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("supports bounded arrow inspection, endpoint jumps and clearing both pointer and pin", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onPin = vi.fn(), onHover = vi.fn();
  const bins: Bin[] = [[null, 0.1, 0], [0.1, 0.2, 0.7], [0.2, null, 0.3]];
  const props = { bins, labels: ["Low", "Middle", "High"], ghost: [null, 0.5, 0.5],
    firstPrintIndex: -1, activeIndex: null, onPin, onHover };
  try {
    await act(async () => root.render(createElement(BinChart, props)));
    const svg = host.querySelector("svg")!;
    for (const key of ["ArrowRight", "End", "Home", "Escape"]) {
      const press = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      await act(async () => svg.dispatchEvent(press));
      expect(press.defaultPrevented).toBe(true);
    }
    expect(onPin.mock.calls.map(([i]) => i)).toEqual([0, 2, 0, null]);
    expect(onHover).toHaveBeenLastCalledWith(null);
    await act(async () => root.render(createElement(BinChart, { ...props, activeIndex: 2 })));
    await act(async () => svg.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
    expect(onPin).toHaveBeenLastCalledWith(2);
    expect(host.querySelector('[stroke="var(--actual)"]')).toBeNull();
    expect(svg.getAttribute("aria-label")).toContain("Home and End");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
