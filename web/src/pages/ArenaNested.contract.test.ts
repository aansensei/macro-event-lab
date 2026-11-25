// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadArena, type Arena as ArenaData } from "../data/arena";
import { Arena } from "./Arena";

vi.mock("../data/arena", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/arena")>()),
  loadArena: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function findSummaryByText(text: string): HTMLElement | null {
  return [...host.querySelectorAll<HTMLElement>("summary")]
    .find((el) => normalizeText(el.textContent) === text) ?? null;
}

function findDetailsBySummary(text: string): HTMLDetailsElement | null {
  const summary = findSummaryByText(text);
  return summary ? summary.closest("details") : null;
}

function buildNestedArenaData(options: { includeMoreScores?: boolean; includeNested?: boolean } = {}): ArenaData {
  const { includeMoreScores = true, includeNested = true } = options;
  return {
    schema_version: 1,
    information_date: "2026-11-20",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
      { id: "payrolls", label: "Payrolls", unit: "thousands of jobs", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Naive baseline", kind: "baseline", note: "Previous value." },
      { id: "ar", label: "Autoregression", kind: "classical", note: "AR model." },
      { id: "ridge", label: "Ridge regression", kind: "classical", note: "Penalized regression." },
    ],
    forecasts: [
      {
        target: "gdp",
        period: "2025-01-01",
        made_on: "2025-02-15",
        actual: 1.0,
        values: { naive: 0.5, ar: 0.9, ridge: 1.1 },
        intervals: {},
      },
    ],
    scores: [
      {
        target: "gdp",
        contestant: "naive",
        window: "all",
        n: 40,
        mae: 0.8,
        rmse: 1.1,
        coverage_90: 0.85,
        dm_vs_naive_p: null,
        n_intervals: 40,
        coverage_90_lo: 0.72,
        coverage_90_hi: 0.93,
        pinball_05: includeMoreScores ? 0.12 : null,
        pinball_50: includeMoreScores ? 0.34 : null,
        pinball_95: includeMoreScores ? 0.18 : null,
        aci_n: includeMoreScores ? 30 : null,
        aci_coverage_90: includeMoreScores ? 0.87 : null,
      },
      {
        target: "gdp",
        contestant: "ar",
        window: "all",
        n: 40,
        mae: 0.7,
        rmse: 0.95,
        coverage_90: 0.875,
        dm_vs_naive_p: 0.12,
        n_intervals: 40,
        coverage_90_lo: 0.74,
        coverage_90_hi: 0.95,
        pinball_05: includeMoreScores ? 0.1 : null,
        pinball_50: includeMoreScores ? 0.31 : null,
        pinball_95: includeMoreScores ? 0.16 : null,
        aci_n: includeMoreScores ? 30 : null,
        aci_coverage_90: includeMoreScores ? 0.9 : null,
      },
    ],
    leakage: [],
    live: [],
    nested_tests: includeNested
      ? [
          { target: "gdp", restricted: "naive", larger: "ar", window: "all", n: 40, statistic: 2.15, p_value: 0.018 },
          { target: "gdp", restricted: "ar", larger: "ridge", window: "all", n: 36, statistic: -0.45, p_value: 0.672 },
          { target: "gdp", restricted: "naive", larger: "ar", window: "clean", n: 12, statistic: 1.5, p_value: 0.071 },
          { target: "cpi", restricted: "naive", larger: "ar", window: "all", n: 60, statistic: 3.1, p_value: 0.001 },
        ]
      : [],
  } as unknown as ArenaData;
}

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Arena Nested model tests section", () => {
  it("renders Nested model tests after More scores inside the leaderboard section, closed by default, with HowToRead, table and count sentence", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildNestedArenaData({ includeMoreScores: true, includeNested: true }));
    await act(async () => root.render(createElement(Arena)));

    const leaderboardHeading = [...host.querySelectorAll("h1, h2, h3, [role='heading']")]
      .find((h) => normalizeText(h.textContent) === "Forecast leaderboard");
    expect(leaderboardHeading).toBeDefined();
    const leaderboardSection = leaderboardHeading!.closest("section")!;

    const moreDetails = findDetailsBySummary("More scores: pinball loss and adaptive coverage");
    const nestedDetails = findDetailsBySummary("Nested model tests (Clark and West)");
    expect(moreDetails).not.toBeNull();
    expect(nestedDetails).not.toBeNull();
    expect(leaderboardSection.contains(nestedDetails)).toBe(true);
    expect(nestedDetails!.open).toBe(false);
    expect(Boolean(moreDetails!.compareDocumentPosition(nestedDetails!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    const summary = findSummaryByText("Nested model tests (Clark and West)")!;
    await act(async () => summary.click());
    expect(nestedDetails!.open).toBe(true);

    const howToReadSummary = [...nestedDetails!.querySelectorAll("summary")]
      .find((el) => normalizeText(el.textContent) === "How to read this table");
    expect(howToReadSummary).toBeDefined();

    const nestedTable = [...nestedDetails!.querySelectorAll<HTMLTableElement>('[role="table"], table')][0];
    expect(nestedTable).toBeDefined();
    expect(Boolean(howToReadSummary!.compareDocumentPosition(nestedTable!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    const howToReadText = normalizeText(howToReadSummary!.closest("details")!.textContent);
    expect(howToReadText).toMatch(/larger/i);
    expect(howToReadText).toMatch(/one[\s-]sided|chance/i);
    expect(howToReadText).toMatch(/equal/i);

    const headers = [...nestedTable!.querySelectorAll('[role="columnheader"], thead th')].map((h) => normalizeText(h.textContent));
    expect(headers).toHaveLength(5);
    expect(headers[0]).toBe("Restricted");
    expect(headers[1]).toBe("Larger");
    expect(headers[2]).toBe("Periods");
    expect(headers[3]).toBe("Statistic");
    expect(headers[4]!.toLowerCase()).toBe("p value");

    const rows = [...nestedTable!.querySelectorAll("tbody tr, tbody [role='row']")];
    expect(rows).toHaveLength(2);

    const row0Text = [...rows[0]!.querySelectorAll("th, td, [role='rowheader'], [role='cell']")].map((c) => normalizeText(c.textContent));
    expect(row0Text[0]).toBe("Naive baseline");
    expect(row0Text[1]).toBe("Autoregression");
    expect(row0Text[2]).toBe("40");
    expect(row0Text[3]).toMatch(/^2\.15/);
    expect(row0Text[4]).toMatch(/^(0\.0180?|0\.02)$/);

    const row1Text = [...rows[1]!.querySelectorAll("th, td, [role='rowheader'], [role='cell']")].map((c) => normalizeText(c.textContent));
    expect(row1Text[0]).toBe("Autoregression");
    expect(row1Text[1]).toBe("Ridge regression");
    expect(row1Text[2]).toBe("36");
    expect(row1Text[3]).toMatch(/^-0\.45/);
    expect(row1Text[4]).toMatch(/^(0\.672|0\.67)$/);

    expect(normalizeText(nestedDetails!.textContent)).toContain(
      "2 tests are shown in this table. No correction for several comparisons is applied.",
    );
  });

  it("filters nested tests by selected window and target and hides the section when none match", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildNestedArenaData({ includeMoreScores: false, includeNested: true }));
    await act(async () => root.render(createElement(Arena)));

    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).toBeNull();
    expect(findSummaryByText("Nested model tests (Clark and West)")).not.toBeNull();

    const cleanButton = [...host.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Evaluation window"] button')]
      .find((btn) => normalizeText(btn.textContent) === "Clean periods");
    expect(cleanButton).toBeDefined();
    await act(async () => cleanButton!.click());

    const nestedAfterWindow = findDetailsBySummary("Nested model tests (Clark and West)")!;
    expect(nestedAfterWindow).not.toBeNull();
    const cleanRows = [...nestedAfterWindow.querySelectorAll("tbody tr, tbody [role='row']")];
    expect(cleanRows).toHaveLength(1);
    expect(normalizeText(nestedAfterWindow.textContent)).toMatch(
      /1 tests? (is|are) shown in this table\. No correction for several comparisons is applied\./,
    );

    const allButton = [...host.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Evaluation window"] button')]
      .find((btn) => normalizeText(btn.textContent) === "All periods");
    await act(async () => allButton!.click());

    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const cpiRadio = radios.find((btn) => normalizeText(btn.textContent).includes("Inflation"))!;
    await act(async () => cpiRadio.click());

    const nestedCpi = findDetailsBySummary("Nested model tests (Clark and West)")!;
    expect(nestedCpi).not.toBeNull();
    expect(nestedCpi.querySelectorAll("tbody tr, tbody [role='row']")).toHaveLength(1);
    expect(normalizeText(nestedCpi.textContent)).toContain("60");

    const payrollsRadio = radios.find((btn) => normalizeText(btn.textContent).includes("Payrolls"))!;
    await act(async () => payrollsRadio.click());
    expect(findSummaryByText("Nested model tests (Clark and West)")).toBeNull();
  });

  it("does not render Nested model tests when nested_tests is empty", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildNestedArenaData({ includeMoreScores: true, includeNested: false }));
    await act(async () => root.render(createElement(Arena)));
    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).not.toBeNull();
    expect(findSummaryByText("Nested model tests (Clark and West)")).toBeNull();
  });
});
