// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadArena, type Arena } from "../data/arena";
import { Play } from "./Play";

vi.mock("../data/arena", async (importOriginal) => ({
  ...await importOriginal<typeof import("../data/arena")>(),
  loadArena: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const playArena: Arena = {
  schema_version: 1,
  information_date: "2026-11-20",
  targets: [
    { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
    { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
  ],
  contestants: [
    { id: "naive", label: "Naive", kind: "baseline", note: "Baseline." },
    { id: "ar", label: "Autoregression", kind: "classical", note: "Classical." },
  ],
  forecasts: [
    { target: "gdp", period: "2023-01-01", made_on: "2023-02-15", actual: 10.11, values: { naive: 10.0, ar: 10.2 }, intervals: {} },
    { target: "gdp", period: "2023-04-01", made_on: "2023-05-15", actual: 11.22, values: { naive: 11.0, ar: 11.4 }, intervals: {} },
    { target: "gdp", period: "2023-07-01", made_on: "2023-08-15", actual: 12.33, values: { naive: 12.0, ar: 12.5 }, intervals: {} },
    { target: "gdp", period: "2023-10-01", made_on: "2023-11-15", actual: 13.44, values: { naive: 13.0, ar: 13.6 }, intervals: {} },
    { target: "gdp", period: "2024-01-01", made_on: "2024-02-15", actual: 14.55, values: { naive: 14.0, ar: 14.7 }, intervals: {} },
    { target: "gdp", period: "2024-04-01", made_on: "2024-05-15", actual: 15.66, values: { naive: 15.0, ar: 15.8 }, intervals: {} },
    { target: "cpi", period: "2024-01-01", made_on: "2024-02-10", actual: 20.11, values: { naive: 20.0, ar: 20.2 }, intervals: {} },
    { target: "cpi", period: "2024-02-01", made_on: "2024-03-10", actual: 21.22, values: { naive: 21.0, ar: 21.3 }, intervals: {} },
    { target: "cpi", period: "2024-03-01", made_on: "2024-04-10", actual: 22.33, values: { naive: 22.0, ar: 22.4 }, intervals: {} },
    { target: "cpi", period: "2024-04-01", made_on: "2024-05-10", actual: 23.44, values: { naive: 23.0, ar: 23.5 }, intervals: {} },
    { target: "cpi", period: "2024-05-01", made_on: "2024-06-10", actual: 24.55, values: { naive: 24.0, ar: 24.6 }, intervals: {} },
    { target: "cpi", period: "2024-06-01", made_on: "2024-07-10", actual: 25.66, values: { naive: 25.0, ar: 25.7 }, intervals: {} },
  ],
  scores: [],
  leakage: [],
  live: [],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/?page=play&seed=123");
  vi.mocked(loadArena).mockResolvedValue(structuredClone(playArena));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

it("plays a full 5 round game without showing the actual in history and displays summary", async () => {
  await act(async () => root.render(createElement(Play)));

  for (let round = 0; round < 5; round += 1) {
    const cutoffText = host.querySelector(".play-cutoff")?.textContent ?? "";
    expect(cutoffText).toContain("Information as of ");
    const madeOn = cutoffText.replace("Information as of ", "").trim();
    const heading = host.querySelector("#play-round h2")?.textContent ?? "";
    const targetId = heading.startsWith("GDP growth") ? "gdp" : "cpi";
    const matchingRow = playArena.forecasts.find((row) => row.target === targetId && row.made_on === madeOn);
    expect(matchingRow).toBeDefined();

    const historyText = host.querySelector(".play-history-wrap")?.textContent ?? "";
    expect(historyText).not.toContain(matchingRow!.actual!.toFixed(2));

    const input = host.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);

    await act(async () => {
      setInputValue(input, "12.5");
    });
    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(host.querySelector(".play-outcome")?.textContent).toContain(matchingRow!.actual!.toFixed(2));
    const nextButton = [...host.querySelectorAll<HTMLButtonElement>("#play-round button")]
      .find((button) => button.textContent === "Next round")!;
    await act(async () => nextButton.click());
  }

  expect(host.textContent).toContain("You played 5 rounds. A game this short is mostly luck.");
  expect(host.textContent).toContain("Rounds played so far: 5");
  expect([...host.querySelectorAll<HTMLButtonElement>("button")].some((b) => b.textContent === "Play again")).toBe(true);
});
