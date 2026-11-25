// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { ThemeSwitch } from "./ThemeSwitch";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.setAttribute("data-theme-pref", "system");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("keeps two ThemeSwitch instances in step without reloading", async () => {
  await act(async () => root.render(createElement("div", null, createElement(ThemeSwitch), createElement(ThemeSwitch))));
  const groups = host.querySelectorAll('[role="group"][aria-label="Color theme"]');
  expect(groups).toHaveLength(2);
  const firstDark = groups[0]!.querySelector<HTMLButtonElement>('button[aria-label="Dark"]')!;
  const secondDark = groups[1]!.querySelector<HTMLButtonElement>('button[aria-label="Dark"]')!;
  const firstLight = groups[0]!.querySelector<HTMLButtonElement>('button[aria-label="Light"]')!;
  const secondLight = groups[1]!.querySelector<HTMLButtonElement>('button[aria-label="Light"]')!;

  await act(async () => firstDark.click());
  expect(firstDark.getAttribute("aria-pressed")).toBe("true");
  expect(secondDark.getAttribute("aria-pressed")).toBe("true");
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  expect(document.documentElement.getAttribute("data-theme-pref")).toBe("dark");

  await act(async () => secondLight.click());
  expect(firstLight.getAttribute("aria-pressed")).toBe("true");
  expect(secondLight.getAttribute("aria-pressed")).toBe("true");
  expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  expect(document.documentElement.getAttribute("data-theme-pref")).toBe("light");
});
