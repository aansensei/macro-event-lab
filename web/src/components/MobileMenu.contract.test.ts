// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "../lib/url";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

function accessibleName(element: Element): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim() !== "") return ariaLabel.trim();

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(" ");
    if (text !== "") return text;
  }

  return element.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function installMatchMedia(dark = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? dark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function renderMenu(page: Page, onNavigate: (p: Page) => void) {
  const { MobileMenu } = await import("./MobileMenu");
  await act(async () => {
    root.render(createElement(MobileMenu, { page, onNavigate }));
  });
}

function getMenuButton(): HTMLButtonElement {
  const btn = [...host.querySelectorAll<HTMLButtonElement>("button")]
    .find((b) => accessibleName(b) === "Menu" || b.textContent?.includes("Menu"));
  expect(btn).toBeDefined();
  return btn!;
}

beforeEach(() => {
  vi.stubEnv("VITE_EDITION", "public");
  vi.resetModules();
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-pref");
  document.documentElement.className = "";
  Object.defineProperty(window, "innerWidth", { value: 402, writable: true, configurable: true });
  installMatchMedia(false);

  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("MobileMenu", () => {
  it("renders a Menu trigger button with icon, aria-haspopup, and aria-expanded", async () => {
    await renderMenu("overview", vi.fn());

    const trigger = getMenuButton();
    expect(trigger.textContent).toContain("Menu");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      trigger.click();
    });

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(accessibleName(dialog!)).toBe("Menu");
  });

  it("shows a Close menu button, Main and More headings, all public links, and marks the current page", async () => {
    const { navigationFor } = await import("../lib/navigation");
    const { primary, learn } = navigationFor(true);

    await renderMenu("data", vi.fn());

    await act(async () => {
      getMenuButton().click();
    });

    const dialog = document.querySelector('[role="dialog"]')!;
    const closeBtn = [...dialog.querySelectorAll<HTMLButtonElement>("button")]
      .find((b) => accessibleName(b) === "Close menu");
    expect(closeBtn).toBeDefined();

    const headings = [...dialog.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading']")]
      .map((h) => h.textContent?.trim());
    const mainIndex = headings.indexOf("Main");
    const moreIndex = headings.indexOf("More");
    expect(mainIndex).toBeGreaterThanOrEqual(0);
    expect(moreIndex).toBeGreaterThan(mainIndex);

    const links = [...dialog.querySelectorAll<HTMLAnchorElement>("a")];
    const expected = [...primary, ...learn];
    expect(links).toHaveLength(expected.length);

    expected.forEach(([expectedPage, expectedLabel], index) => {
      const link = links[index]!;
      expect(link.getAttribute("href")).toBe(`?page=${expectedPage}`);
      expect(link.textContent?.trim()).toBe(expectedLabel);
      if (expectedPage === "data") {
        expect(link.getAttribute("aria-current")).toBe("page");
      } else {
        expect(link.getAttribute("aria-current")).toBeNull();
      }
    });

    await act(async () => {
      closeBtn!.click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(getMenuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("prevents default link navigation, calls onNavigate, and closes on link choice", async () => {
    const onNavigate = vi.fn();
    await renderMenu("overview", onNavigate);

    await act(async () => {
      getMenuButton().click();
    });

    const dialog = document.querySelector('[role="dialog"]')!;
    const arenaLink = [...dialog.querySelectorAll<HTMLAnchorElement>("a")]
      .find((a) => a.getAttribute("href") === "?page=arena")!;
    expect(arenaLink).toBeDefined();

    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(async () => {
      arenaLink.dispatchEvent(clickEvent);
    });

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("arena");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(getMenuButton().getAttribute("aria-expanded")).toBe("false");
  });

  it("closes on Escape, restores focus to the Menu button, and keeps Tab inside the dialog", async () => {
    await renderMenu("overview", vi.fn());

    const trigger = getMenuButton();
    await act(async () => {
      trigger.click();
    });

    const dialog = document.querySelector('[role="dialog"]')!;
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    expect(focusables.length).toBeGreaterThan(2);

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    last.focus();
    await act(async () => {
      last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(first);

    await act(async () => {
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(last);

    const escapeTarget = dialog.contains(document.activeElement) && document.activeElement
      ? document.activeElement
      : dialog;
    await act(async () => {
      escapeTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("renders a Theme section with the three theme buttons that update theme state", async () => {
    await renderMenu("overview", vi.fn());

    await act(async () => {
      getMenuButton().click();
    });

    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain("Theme");

    const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button")];
    const systemBtn = buttons.find((b) => /^(match the device|system)$/i.test(accessibleName(b)));
    const lightBtn = buttons.find((b) => /^light$/i.test(accessibleName(b)));
    const darkBtn = buttons.find((b) => /^dark$/i.test(accessibleName(b)));

    expect(systemBtn).toBeDefined();
    expect(lightBtn).toBeDefined();
    expect(darkBtn).toBeDefined();

    await act(async () => {
      darkBtn!.click();
    });
    expect(darkBtn!.getAttribute("aria-pressed")).toBe("true");
    expect(lightBtn!.getAttribute("aria-pressed")).toBe("false");
    expect(systemBtn!.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.getAttribute("data-theme-pref")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await act(async () => {
      lightBtn!.click();
    });
    expect(lightBtn!.getAttribute("aria-pressed")).toBe("true");
    expect(darkBtn!.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.getAttribute("data-theme-pref")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await act(async () => {
      systemBtn!.click();
    });
    expect(systemBtn!.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute("data-theme-pref")).toBe("system");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("closes when the window resizes to 800 pixels or wider and stays open below 800", async () => {
    await renderMenu("overview", vi.fn());

    const trigger = getMenuButton();
    await act(async () => {
      trigger.click();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    Object.defineProperty(window, "innerWidth", { value: 799, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    Object.defineProperty(window, "innerWidth", { value: 800, writable: true, configurable: true });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
