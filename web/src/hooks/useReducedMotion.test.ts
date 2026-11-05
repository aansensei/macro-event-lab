// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useCountUp } from "./useCountUp";
import { useReducedMotion } from "./useReducedMotion";
import { useTween } from "./useTween";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
let media: MediaQueryList & EventTarget;

function MotionReading({ target = 20 }: { target?: number }) {
  const reduced = useReducedMotion();
  const shown = useCountUp(target);
  return createElement("output", null, `${reduced}:${shown}`);
}

function TweenReading({ target, shape = "line" }: { target: number[]; shape?: string }) {
  return createElement("output", null, useTween(target, shape).join(","));
}

beforeEach(() => {
  vi.useFakeTimers();
  media = Object.assign(new EventTarget(), { matches: false }) as MediaQueryList & EventTarget;
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 42));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("settles an active count when the preference changes and does not replay it", async () => {
  const add = vi.spyOn(media, "addEventListener");
  const remove = vi.spyOn(media, "removeEventListener");
  await act(async () => root.render(createElement(MotionReading)));
  expect(host.textContent).toBe("false:0");
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  await act(async () => {
    Object.assign(media, { matches: true });
    media.dispatchEvent(new Event("change"));
  });
  expect(host.textContent).toBe("true:20");
  expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => {
    Object.assign(media, { matches: false });
    media.dispatchEvent(new Event("change"));
  });
  expect(host.textContent).toBe("false:20");
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  await act(async () => root.render(null));
  expect(add).toHaveBeenCalledTimes(2);
  for (const [type, handler] of add.mock.calls) expect(remove).toHaveBeenCalledWith(type, handler);
});

it("shows current values immediately when reduced motion is enabled", async () => {
  Object.assign(media, { matches: true });
  await act(async () => root.render(createElement(MotionReading)));
  expect(host.textContent).toBe("true:20");
  await act(async () => root.render(createElement(MotionReading, { target: 35 })));
  expect(host.textContent).toBe("true:35");
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

it("settles an animated value when animation frames are not delivered", async () => {
  await act(async () => root.render(createElement(MotionReading)));
  await act(async () => vi.advanceTimersByTime(800));
  expect(host.textContent).toBe("false:20");
  await act(async () => root.render(createElement(MotionReading, { target: 35 })));
  await act(async () => vi.advanceTimersByTime(800));
  expect(host.textContent).toBe("false:35");
});

it("settles an active chart transition when reduced motion changes", async () => {
  await act(async () => root.render(createElement(TweenReading, { target: [0, 1] })));
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  await act(async () => root.render(createElement(TweenReading, { target: [10, 20] })));
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
  await act(async () => { Object.assign(media, { matches: true }); media.dispatchEvent(new Event("change")); });
  expect(host.textContent).toBe("10,20");
  expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  await act(async () => { Object.assign(media, { matches: false }); media.dispatchEvent(new Event("change")); });
  expect(host.textContent).toBe("10,20");
  expect(requestAnimationFrame).toHaveBeenCalledOnce();
});

it("draws a different chart shape immediately rather than blending incompatible values", async () => {
  await act(async () => root.render(createElement(TweenReading, { target: [0, 1] })));
  await act(async () => root.render(createElement(TweenReading, { target: [10, 20, 30], shape: "different" })));
  expect(host.textContent).toBe("10,20,30");
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
