// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LearnMenu } from "./LearnMenu";
import { RevisionReveal } from "./RevisionReveal";
import { SiteGuide } from "./SiteGuide";
import { About } from "../pages/About";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("reveals the exact latest vintage on request and can replay without invented intermediate values", async () => {
  await act(async () => root.render(createElement(RevisionReveal, { example: {
    period: "2021-11-01", first: 210000, latest: 658000, vintage: "2026-10-02",
  } })));
  expect(host.textContent).toContain("+210,000");
  expect(host.textContent).not.toContain("+658,000");
  const button = host.querySelector("button")!;
  await act(async () => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain("+658,000");
  await act(async () => button.click());
  expect(host.textContent).not.toContain("+658,000");
});

it("Learn supports keyboard choice, Escape and focus return without putting About inside", async () => {
  const navigate = vi.fn();
  await act(async () => root.render(createElement(LearnMenu, { page: "overview", onNavigate: navigate })));
  const trigger = host.querySelector("button")!;
  await act(async () => trigger.click());
  let list = host.querySelector('[role="listbox"]') as HTMLUListElement;
  expect(list.textContent).toContain("Models");
  expect(list.textContent).not.toContain("About");
  expect(document.activeElement).toBe(list);
  await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(document.activeElement).toBe(trigger);
  expect(host.querySelector('[role="listbox"]')).toBeNull();
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));
  list = host.querySelector('[role="listbox"]') as HTMLUListElement;
  await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
  await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(navigate).toHaveBeenCalledWith("glossary");
  expect(document.activeElement).toBe(trigger);
});

it("places the reading guide on Overview and leaves a useful link on About", () => {
  const guide = renderToStaticMarkup(createElement(SiteGuide));
  expect(guide).toContain('id="overview-guide"');
  expect(guide.match(/<li /g)).toHaveLength(4);
  expect(guide).toContain("Share a moment");
  const about = renderToStaticMarkup(createElement(About));
  expect(about).toContain("?page=overview#overview-guide");
  expect(about).not.toContain("howto-steps");
});
