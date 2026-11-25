// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { REVEAL_SELECTOR, armReveal, revealDelay } from "./scrollReveal";

type Callback = (entries: { target: Element; isIntersecting: boolean }[]) => void;

let callback: Callback = () => {};
let observed: Element[] = [];
let disconnected = false;

class FakeObserver {
  constructor(cb: Callback) {
    callback = cb;
    observed = [];
    disconnected = false;
  }
  observe(target: Element) { observed.push(target); }
  unobserve(target: Element) { observed = observed.filter((item) => item !== target); }
  disconnect() { disconnected = true; }
}

const Observer = FakeObserver as unknown as typeof IntersectionObserver;

function page() {
  const root = document.createElement("main");
  root.innerHTML = `<section class="about-section" id="a"></section><section class="arena-section" id="b"></section><div class="other" id="c"></div>`;
  document.body.append(root);
  return root;
}

function block(root: HTMLElement, id: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ""; });

it("delays blocks that appear together by 70 ms each and at most 280 ms", () => {
  expect([0, 1, 2, 3, 4, 5, 9].map(revealDelay)).toEqual([0, 70, 140, 210, 280, 280, 280]);
  expect(revealDelay(-3)).toBe(0);
});

it("marks only the matching blocks as waiting and observes them", () => {
  const root = page();
  armReveal(root, Observer);
  expect(root.querySelector("#a")?.getAttribute("data-reveal")).toBe("pending");
  expect(root.querySelector("#b")?.getAttribute("data-reveal")).toBe("pending");
  expect(root.querySelector("#c")?.hasAttribute("data-reveal")).toBe(false);
  expect(observed).toHaveLength(2);
});

it("shows a block when it enters the screen and clears the mark a second later", () => {
  const root = page();
  armReveal(root, Observer);
  const first = block(root, "#a");
  const second = block(root, "#b");
  callback([{ target: first, isIntersecting: true }, { target: second, isIntersecting: true }]);
  expect(first.dataset.reveal).toBe("in");
  expect(first.style.getPropertyValue("--reveal-delay")).toBe("0ms");
  expect(second.style.getPropertyValue("--reveal-delay")).toBe("70ms");
  expect(observed).toHaveLength(0);
  vi.advanceTimersByTime(1000);
  expect(first.hasAttribute("data-reveal")).toBe(false);
  expect(first.style.getPropertyValue("--reveal-delay")).toBe("");
});

it("keeps a block waiting while it is off screen", () => {
  const root = page();
  armReveal(root, Observer);
  const first = block(root, "#a");
  callback([{ target: first, isIntersecting: false }]);
  expect(first.dataset.reveal).toBe("pending");
});

it("hides nothing without an IntersectionObserver", () => {
  const root = page();
  armReveal(root, undefined);
  expect(root.querySelectorAll("[data-reveal]")).toHaveLength(0);
});

it("picks up blocks that are added later and does not mark a revealed block again", async () => {
  const root = page();
  armReveal(root, Observer);
  const first = block(root, "#a");
  callback([{ target: first, isIntersecting: true }]);
  vi.advanceTimersByTime(1000);
  const late = document.createElement("section");
  late.className = "status-section";
  root.append(late);
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  expect(late.dataset.reveal).toBe("pending");
  expect(first.hasAttribute("data-reveal")).toBe(false);
});

it("stops observing when it is switched off", () => {
  const root = page();
  const stop = armReveal(root, Observer);
  stop();
  expect(disconnected).toBe(true);
});

it("lists the blocks to reveal without any dash", () => {
  expect(REVEAL_SELECTOR).toContain(".about-section");
  expect(REVEAL_SELECTOR).not.toContain(".built-card");
  expect(REVEAL_SELECTOR).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`));
});
