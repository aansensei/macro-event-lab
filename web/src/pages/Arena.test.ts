// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadArena } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import { Arena } from "./Arena";

vi.mock("../data/arena", async (importOriginal) => ({
  ...await importOriginal<typeof import("../data/arena")>(), loadArena: vi.fn(),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadArena).mockResolvedValue(structuredClone(arenaFixture));
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("shows supplied records, a single chart contestant and a collapsed counts-only audit", async () => {
  await act(async () => root.render(createElement(Arena)));
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.querySelectorAll('[role="radio"][tabindex="0"]')).toHaveLength(1);
  expect(host.querySelectorAll(".arena-table tbody tr")).toHaveLength(9);
  expect(host.querySelector(".arena-section .arena-table")?.querySelectorAll("tbody tr")).toHaveLength(3);
  expect(host.querySelector(".arena-leakage")?.hasAttribute("open")).toBe(false);
  expect(host.querySelector(".arena-leakage")?.textContent).toContain("does not specify their target and measurement units");
  expect(host.querySelector(".arena-audit-table")?.textContent).not.toMatch(/RMSE/);
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Fixture B");
  expect(host.querySelector("#arena-live")).toBeNull();
  expect(host.textContent).not.toContain("Layout sample");
});

it("supports radio arrow navigation and honest target/window empty states", async () => {
  await act(async () => root.render(createElement(Arena)));
  const radios = host.querySelectorAll<HTMLButtonElement>('[role="radio"]');
  await act(async () => radios[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(document.activeElement).toBe(radios[1]);
  expect(radios[1]?.getAttribute("aria-checked")).toBe("true");
  expect(host.textContent).toContain("No scores are available for this target and window");
  expect(host.textContent).toContain("No forecast history");
  await act(async () => radios[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(radios[0]?.getAttribute("aria-checked")).toBe("true");
  await act(async () => host.querySelectorAll<HTMLButtonElement>(".arena-window button")[1]!.click());
  expect(host.textContent).toContain("Period sets can differ");
  expect(host.textContent).toContain("No scores are available");
});

it("changes presentation sorting without rewriting RMSE ranks", async () => {
  await act(async () => root.render(createElement(Arena)));
  const firstLabel = () => host.querySelector(".arena-section .arena-table tbody tr th")?.textContent;
  expect(firstLabel()).toContain("Fixture B");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Reverse leaderboard sort direction"]')!.click());
  expect(firstLabel()).toContain("Fixture A");
  expect(host.querySelector(".arena-section .arena-table tbody tr td")?.textContent).toBe("2");
  expect(host.querySelector('[aria-sort="descending"]')?.textContent).toBe("RMSE");
});

it("inspects the full chart readout with Home, End and arrow keys", async () => {
  await act(async () => root.render(createElement(Arena)));
  const chart = host.querySelector<SVGSVGElement>('svg[role="img"]')!;
  await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Q1 2025");
  expect(host.querySelector(".arena-readout")?.textContent).toContain("First print 0.00");
  expect(host.querySelector(".arena-readout")?.textContent).toContain("interval not available");
  await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Q2 2025");
  await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Q1 2025");
  await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Q2 2025");
});

it("keeps a point forecast selectable when its interval is missing", async () => {
  await act(async () => root.render(createElement(Arena)));
  expect(host.querySelector('[data-series="forecast"]')?.getAttribute("d")).toContain("M");
  const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Chart contestant: Fixture B"]')!;
  await act(async () => trigger.click());
  const list = host.querySelector<HTMLUListElement>('[aria-label="Chart contestant"][role="listbox"]')!;
  await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  await act(async () => list.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
  expect(host.querySelector(".arena-readout")?.textContent).toContain("Fixture A");
  expect(document.activeElement).toBe(trigger);
});

it("renders a live section only for matching supplied entries and keeps nulls absent", async () => {
  vi.mocked(loadArena).mockResolvedValueOnce({ ...arenaFixture, live: [
    { target: "gdp", period: "2026-10-01", as_of: "2026-11-15", values: { naive: 0, "fixture-b": null } },
  ] });
  await act(async () => root.render(createElement(Arena)));
  expect(host.querySelector(".arena-live")?.textContent).toContain("Q4 2026");
  expect(host.querySelector(".arena-live")?.textContent).toContain("0.00");
  expect(host.querySelector(".arena-live")?.textContent).toContain("No forecast");
  await act(async () => host.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1]!.click());
  expect(host.querySelector("#arena-live")).toBeNull();
});

it("treats unpublished results as a pending state and can check again", async () => {
  vi.mocked(loadArena).mockRejectedValueOnce(new Error("The arena has not been built yet"));
  await act(async () => root.render(createElement("main", { tabIndex: -1 }, createElement(Arena))));
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Forecast results are not available yet");
  expect(host.querySelector('a[href="?page=revisions"]')).not.toBeNull();
  expect(host.querySelector('a[href="?page=models"]')).not.toBeNull();
  expect(host.querySelector("table")).toBeNull();
  const button = host.querySelector<HTMLButtonElement>('[role="status"] button')!;
  button.focus();
  await act(async () => button.click());
  expect(host.querySelector(".arena-section table")).not.toBeNull();
  expect(document.activeElement).toBe(host.querySelector("main"));
  expect(loadArena).toHaveBeenCalledTimes(2);
});

it.each(["Unsupported arena data version. This page reads version 1.", "The data file could not be reached."])("recovers from %s", async (message) => {
  vi.mocked(loadArena).mockRejectedValueOnce(new Error(message));
  await act(async () => root.render(createElement("main", { tabIndex: -1 }, createElement(Arena))));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain(message);
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(document.activeElement).toBe(host.querySelector("main"));
});

it("handles an empty contract and an unresolved request without fake data", async () => {
  vi.mocked(loadArena).mockResolvedValueOnce({ ...arenaFixture, targets: [], contestants: [], forecasts: [], scores: [], leakage: [], live: [] });
  await act(async () => root.render(createElement(Arena)));
  expect(host.textContent).toContain("No economic targets are available yet");
  expect(host.querySelector("table")).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(host);
  vi.mocked(loadArena).mockReturnValueOnce(new Promise(() => {}));
  await act(async () => root.render(createElement(Arena)));
  expect(host.querySelector('[role="status"]')?.textContent).toBe("Loading forecast arena data.");
  expect(host.textContent).not.toContain("Fixture");
});

it("renders coverage intervals, closed More scores and Nested model tests sections, and Not available cells", async () => {
  await act(async () => root.render(createElement(Arena)));
  const leaderboardText = host.querySelector(".arena-section .arena-table")?.textContent ?? "";
  expect(leaderboardText).toContain("95% interval 9% to 91%, 2 forecasts");
  expect(leaderboardText).toContain("95% interval 21% to 100%, 1 forecast");

  const details = Array.from(host.querySelectorAll<HTMLDetailsElement>(".arena-section details.arena-details"));
  expect(details).toHaveLength(2);
  expect(details[0]?.hasAttribute("open")).toBe(false);
  expect(details[1]?.hasAttribute("open")).toBe(false);
  expect(details[0]?.querySelector("summary")?.textContent).toBe("More scores: pinball loss and adaptive coverage");
  expect(details[1]?.querySelector("summary")?.textContent).toBe("Nested model tests (Clark and West)");

  const moreText = details[0]?.textContent ?? "";
  expect(moreText).toContain("Pinball 5%");
  expect(moreText).toContain("Adaptive coverage");
  expect(moreText).toContain("Forecasts scored");
  expect(moreText).toContain("0.15");
  expect(moreText).toContain("Not available");
  expect(moreText).toContain("A few dozen forecasts cannot separate close scores.");

  const nestedText = details[1]?.textContent ?? "";
  expect(nestedText).toContain("Fixture A");
  expect(nestedText).toContain("Fixture B");
  expect(nestedText).toContain("1.45");
  expect(nestedText).toContain("0.142");
  expect(nestedText).toContain("2 tests are shown in this table. No correction for several comparisons is applied.");
});

it("omits coverage interval note, More scores and Nested model tests when those fields are absent", async () => {
  const legacy = structuredClone(arenaFixture);
  legacy.scores = legacy.scores.map(({ target, contestant, window, n, mae, rmse, coverage_90, dm_vs_naive_p }) => ({
    target, contestant, window, n, mae, rmse, coverage_90, dm_vs_naive_p,
  }));
  legacy.nested_tests = [];
  vi.mocked(loadArena).mockResolvedValueOnce(legacy);
  await act(async () => root.render(createElement(Arena)));
  expect(host.textContent).not.toContain("95% interval");
  expect(host.textContent).not.toContain("More scores: pinball loss and adaptive coverage");
  expect(host.textContent).not.toContain("Nested model tests (Clark and West)");
});

it("renders Nested model tests without More scores when only nested pairs exist, and shows Not available for null stats", async () => {
  const partial = structuredClone(arenaFixture);
  partial.scores = partial.scores.map(({ target, contestant, window, n, mae, rmse, coverage_90, dm_vs_naive_p }) => ({
    target, contestant, window, n, mae, rmse, coverage_90, dm_vs_naive_p,
  }));
  partial.nested_tests = [
    { target: "gdp", restricted: "naive", larger: "fixture-b", window: "all", n: 2, statistic: null, p_value: null },
  ];
  vi.mocked(loadArena).mockResolvedValueOnce(partial);
  await act(async () => root.render(createElement(Arena)));
  expect(host.textContent).not.toContain("More scores: pinball loss and adaptive coverage");
  const details = host.querySelectorAll<HTMLDetailsElement>(".arena-section details.arena-details");
  expect(details).toHaveLength(1);
  expect(details[0]?.textContent).toContain("1 tests are shown in this table. No correction for several comparisons is applied.");
  expect(details[0]?.querySelector("table")?.textContent).toContain("Not available");
});
