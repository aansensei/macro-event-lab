// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadRevisions, loadSummary } from "../data/load";
import { loadNowcast } from "../data/nowcast";
import { Compare } from "./Compare";
import { Models } from "./Models";
import { Revisions } from "./Revisions";
import { Scorecard } from "./Scorecard";

vi.mock("../data/load", () => ({ loadSummary: vi.fn(), loadRevisions: vi.fn() }));
vi.mock("../data/nowcast", async (original) => ({ ...await original<object>(), loadNowcast: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLElement;
let root: Root;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadSummary).mockResolvedValue({ schema_version: 1, series: [], points: [] });
  vi.mocked(loadRevisions).mockResolvedValue({ schema_version: 1, settled_months: 24, series: [] });
  vi.mocked(loadNowcast).mockResolvedValue({ schema_version: 1, source: "ALFRED", points: [], coefficients: [] });
  host = document.createElement("main"); host.tabIndex = -1; document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it.each([
  { component: Compare, loader: loadSummary, title: "Compare" },
  { component: Scorecard, loader: loadSummary, title: "Scorecard" },
  { component: Revisions, loader: loadRevisions, title: "Revisions" },
  { component: Models, loader: loadNowcast, title: "Reading GDP before release day" },
])("recovers $title from a source failure without leaving the page", async ({ component, loader, title }) => {
  vi.mocked(loader).mockRejectedValueOnce(new Error("Temporary source failure"));
  await act(async () => root.render(createElement(component)));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Temporary source failure");
  expect(host.querySelector('h1')).not.toBeNull();
  const button = host.querySelector<HTMLButtonElement>('[role="alert"] button')!;
  button.focus();
  await act(async () => button.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector("h1")?.textContent).toBe(title);
  expect(document.activeElement).toBe(host);
  expect(loader).toHaveBeenCalledTimes(2);
  if (component === Models) expect(loadSummary).not.toHaveBeenCalled();
});
