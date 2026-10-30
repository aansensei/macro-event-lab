// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { SummaryPoint } from "../data/types";
import { EventReveal } from "./EventReveal";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

const point: SummaryPoint = { id: "cpi-fixture", series: "KXCPI", title: "CPI fixture",
  surprise_sd: -2.75, dgs2_bp: 12, dgs10_bp: null, in_50: false, in_90: false };
const examples: ComponentProps<typeof EventReveal>["examples"] = [
  { label: "CPI", point }, { label: "Fed", point: { ...point, id: "fed-fixture", series: "KXFED", surprise_sd: 0 } },
];

it("reveals the actual surprise before daily yields without imposing their direction", async () => {
  await act(async () => root.render(createElement(EventReveal, { examples })));
  expect(host.textContent).not.toContain("2.75");
  expect(host.querySelector(".event-yield-result")).toBeNull();
  expect(host.querySelector('[role="img"]')).toBeNull();
  expect(host.querySelector(".event-reveal-actions a")?.getAttribute("href")).toBe("?event=cpi-fixture&h=1&reveal=0");
  const button = host.querySelector<HTMLButtonElement>(".event-reveal-next")!;
  await act(async () => button.click());
  expect(host.querySelector(".event-number")?.textContent).toBe("−2.75 SD");
  expect(host.textContent).toContain("Outside the market's central 90% range");
  expect(host.querySelector(".event-yield-result")).toBeNull();
  expect(host.querySelector(".event-reveal-actions a")?.getAttribute("href")).toBe("?event=cpi-fixture&h=1&reveal=1");
  await act(async () => button.click());
  expect(host.querySelector(".event-yield-result")?.textContent).toContain("+12.0 bp");
  expect(host.querySelector(".event-yield-result")?.textContent).toContain("Unavailable");
  expect(host.textContent).toContain("Other news");
  expect(host.querySelector(".event-reveal-actions a")?.getAttribute("href")).toBe("?event=cpi-fixture&h=1");
  await act(async () => button.click());
  expect(host.querySelector(".event-actual")).toBeNull();
  expect(host.querySelector(".event-yield-result")).toBeNull();
});

it("resets the reveals on selection and keeps a zero surprise finite", async () => {
  await act(async () => root.render(createElement(EventReveal, { examples })));
  await act(async () => host.querySelector<HTMLButtonElement>(".event-reveal-next")!.click());
  const fed = host.querySelectorAll<HTMLButtonElement>('[aria-pressed]')[1]!;
  await act(async () => fed.click());
  expect(fed.getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).not.toContain("2.75");
  expect(host.querySelector(".event-actual")).toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>(".event-reveal-next")!.click());
  expect(host.querySelector<HTMLElement>(".event-actual")?.style.left).toBe("50%");
  expect(host.querySelector(".event-number")?.textContent).toBe("0.00 SD");
  expect(host.querySelector(".event-selection")?.textContent).not.toContain("ALFRED");
});

it("explains missing examples without generating a fallback release", async () => {
  await act(async () => root.render(createElement(EventReveal, { examples: [] })));
  expect(host.textContent).toContain("not available");
  expect(host.querySelector("button")).toBeNull();
});
