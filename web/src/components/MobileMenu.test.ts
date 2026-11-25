// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { menuGroups } from "../lib/menuGroups";
import { LEARN, PRIMARY } from "../lib/navigation";
import { MobileMenu } from "./MobileMenu";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.setAttribute("data-theme-pref", "system");
  Object.defineProperty(window, "innerWidth", { value: 402, configurable: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.documentElement.className = "";
});

it("opens a modal Menu dialog with headings, links, aria-current and theme controls", async () => {
  const onNavigate = vi.fn();
  await act(async () => root.render(createElement(MobileMenu, { page: "revisions", onNavigate })));
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  expect(trigger.textContent).toContain("Menu");
  expect(trigger.querySelector("svg")).not.toBeNull();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(host.querySelector('[role="dialog"]')).toBeNull();

  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(document.documentElement.classList.contains("mobile-menu-open")).toBe(true);

  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.getAttribute("aria-label")).toBe("Menu");
  expect(dialog.querySelector('button[aria-label="Close menu"]')).not.toBeNull();

  const headings = [...dialog.querySelectorAll("h2")].map((h) => h.textContent);
  expect(headings).toEqual(["Main", "More"]);

  const expectedItems = menuGroups(PRIMARY, LEARN).flatMap((g) => g.items);
  const links = [...dialog.querySelectorAll<HTMLAnchorElement>("a")];
  expect(links.map((a) => [a.getAttribute("href"), a.textContent])).toEqual(
    expectedItems.map((item) => [`?page=${item.page}`, item.label]),
  );
  const currentLinks = links.filter((a) => a.getAttribute("aria-current") === "page");
  expect(currentLinks).toHaveLength(1);
  expect(currentLinks[0]!.getAttribute("href")).toBe("?page=revisions");

  const themeSection = dialog.querySelector<HTMLElement>("section")!;
  expect(themeSection.textContent).toContain("Theme");
  const darkButton = themeSection.querySelector<HTMLButtonElement>('button[aria-label="Dark"]')!;
  await act(async () => darkButton.click());
  expect(darkButton.getAttribute("aria-pressed")).toBe("true");
  expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
});

it("calls onNavigate with default prevented and closes when a link is chosen", async () => {
  const onNavigate = vi.fn();
  await act(async () => root.render(createElement(MobileMenu, { page: "overview", onNavigate })));
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
  const targetLink = host.querySelector<HTMLAnchorElement>('[role="dialog"] a[href="?page=about"]')!;
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => {
    targetLink.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(true);
  expect(onNavigate).toHaveBeenCalledWith("about");
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.documentElement.classList.contains("mobile-menu-open")).toBe(false);
});

it("closes on Escape and returns focus to the Menu button", async () => {
  await act(async () => root.render(createElement(MobileMenu, { page: "overview", onNavigate: vi.fn() })));
  const trigger = host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  await act(async () => trigger.click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("keeps Tab inside the open dialog", async () => {
  await act(async () => root.render(createElement(MobileMenu, { page: "overview", onNavigate: vi.fn() })));
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
  const focusables = [...dialog.querySelectorAll<HTMLElement>("a, button")];
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;

  last.focus();
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  expect(document.activeElement).toBe(first);

  first.focus();
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
  });
  expect(document.activeElement).toBe(last);
});

it("closes when the window resizes to 800 pixels or wider", async () => {
  await act(async () => root.render(createElement(MobileMenu, { page: "overview", onNavigate: vi.fn() })));
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click());
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  Object.defineProperty(window, "innerWidth", { value: 800, configurable: true });
  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(document.documentElement.classList.contains("mobile-menu-open")).toBe(false);
});
