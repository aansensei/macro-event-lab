// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { RailPage } from "./SectionRail";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  // the first section sits at the top of the window, the later ones far below it, and the page is long
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = this.id === "a" ? 0 : this.id ? 2000 : 0;
    return { top, bottom: top + 20, left: 0, right: 100, width: 100, height: 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  Object.defineProperty(document.documentElement, "scrollHeight", { value: 6000, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

const sections = [{ id: "a", label: "First" }, { id: "b", label: "Missing" }, { id: "c", label: "Third" }];
const rail = (children: ReturnType<typeof createElement>) => createElement(RailPage, { sections, children });
const page = (...ids: string[]) => createElement("div", null, ...ids.map((id) => createElement("h2", { id, key: id }, id)));
const dots = () => [...host.querySelectorAll(".section-rail a")].map((a) => a.textContent);

it("lists only the sections that exist on the page", async () => {
  await act(async () => root.render(rail(page("a", "c"))));
  expect(dots()).toEqual(["First", "Third"]);
  expect(host.querySelector(".with-rail")).not.toBeNull();
});

it("adds a section to the rail once it appears", async () => {
  await act(async () => root.render(rail(page("a"))));
  expect(dots()).toEqual(["First"]);
  await act(async () => root.render(rail(page("a", "b"))));
  expect(dots()).toEqual(["First", "Missing"]);
});

it("shows a position pill on small screens that opens a contents sheet and closes after a choice", async () => {
  await act(async () => root.render(rail(page("a", "c"))));
  const pill = host.querySelector<HTMLButtonElement>(".contents-pill")!;
  expect(pill.textContent).toContain("1 / 2");
  expect(host.querySelector(".contents-sheet")).toBeNull();
  await act(async () => pill.click());
  const sheet = host.querySelector(".contents-sheet")!;
  expect(sheet.getAttribute("role")).toBe("dialog");
  expect(sheet.getAttribute("aria-modal")).toBe("true");
  expect([...sheet.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["First", "Third"]);
  expect(document.documentElement.classList.contains("contents-open")).toBe(true);
  await act(async () => sheet.querySelectorAll("a")[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
  expect(host.querySelector(".contents-sheet")).toBeNull();
  expect(document.documentElement.classList.contains("contents-open")).toBe(false);
});

it("closes the sheet with Escape and hands focus back to the pill", async () => {
  await act(async () => root.render(rail(page("a", "c"))));
  const pill = host.querySelector<HTMLButtonElement>(".contents-pill")!;
  await act(async () => pill.click());
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  expect(host.querySelector(".contents-sheet")).toBeNull();
  expect(document.activeElement).toBe(pill);
});

it("shows no pill when the page has a single section", async () => {
  await act(async () => root.render(rail(page("a"))));
  expect(host.querySelector(".contents-pill")).toBeNull();
});

it("keeps the back to top offset for the pill only while a pill is shown", async () => {
  await act(async () => root.render(rail(page("a"))));
  expect(document.body.classList.contains("has-contents-pill")).toBe(false);
  await act(async () => root.render(rail(page("a", "c"))));
  expect(document.body.classList.contains("has-contents-pill")).toBe(true);
});

it("closes the sheet and frees the page scroll when the window grows to the wide layout", async () => {
  await act(async () => root.render(rail(page("a", "c"))));
  await act(async () => host.querySelector<HTMLButtonElement>(".contents-pill")!.click());
  expect(document.documentElement.classList.contains("contents-open")).toBe(true);
  Object.defineProperty(window, "innerWidth", { value: 1400, configurable: true });
  await act(async () => { window.dispatchEvent(new Event("resize")); });
  expect(host.querySelector(".contents-sheet")).toBeNull();
  expect(document.documentElement.classList.contains("contents-open")).toBe(false);
});
