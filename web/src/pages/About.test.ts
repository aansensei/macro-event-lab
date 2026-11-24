// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { About } from "./About";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.history.replaceState(null, "", "/?page=about");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it("focuses and scrolls to the disclaimer after a direct link loads About", async () => {
  window.history.replaceState(null, "", "/?page=about#disclaimer");
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  await act(async () => root.render(createElement(About)));
  const section = host.querySelector("#disclaimer")!;
  expect(document.activeElement).toBe(section);
  expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "auto" });
  expect(scroll.mock.contexts).toContain(section);
  expect(section.querySelector("h2")?.textContent).toBe("Disclaimer");
});

it("leaves normal About navigation at the top", async () => {
  const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  await act(async () => root.render(createElement(About)));
  expect(document.activeElement).not.toBe(host.querySelector("#disclaimer"));
  expect(scroll).not.toHaveBeenCalled();
});
