// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { TimeControls } from "./TimeControls";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it("distinguishes the rounded close hour from an exact snapshot timestamp", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onHour = vi.fn();
  const props = { h: 1, hours: [168, 24, 1, 0], ts: "2026-10-13T11:00:00Z", max: 168, min: 0, playing: false, onHour, onPlay: vi.fn() };
  try {
    await act(async () => root.render(createElement(TimeControls, props)));
    const slider = host.querySelector("input")!;
    expect(host.querySelector("label")?.textContent).toBe("Market snapshot hour");
    expect(slider.getAttribute("aria-valuetext")).toContain("before the market close hour, Oct 13 07:00 ET");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Close hour")!.click());
    expect(onHour).toHaveBeenLastCalledWith(0);
    await act(async () => root.render(createElement(TimeControls, { ...props, h: 0 })));
    expect(slider.getAttribute("aria-valuetext")).toContain("The market close hour");
    expect(slider.getAttribute("aria-valuetext")).not.toContain("At the close");
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it("uses recorded hours for keyboard changes while retaining native pointer input", async () => {
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const onHour = vi.fn();
  const props = { h: 24, hours: [24, 1], ts: null, max: 24, min: 1, playing: false, onHour, onPlay: vi.fn() };
  try {
    await act(async () => root.render(createElement(TimeControls, props)));
    const slider = host.querySelector("input")!;
    for (const key of ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"]) {
      const press = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      await act(async () => slider.dispatchEvent(press));
      expect(press.defaultPrevented).toBe(true);
    }
    expect(onHour.mock.calls.map(([h]) => h)).toEqual([1, 1, 24, 24]);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setValue.call(slider, "-12"); slider.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(onHour).toHaveBeenLastCalledWith(12);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
