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

function findTableWithHeaders(expectedHeaders: string[]): HTMLTableElement | null {
  const tables = [...host.querySelectorAll<HTMLTableElement>('[role="table"], table')];
  return tables.find((table) => {
    const headers = [...table.querySelectorAll('[role="columnheader"], thead th')].map((h) => normalizeText(h.textContent));
    return expectedHeaders.every((expected) => headers.some((actual) => actual.includes(expected)));
  }) ?? null;
}

function cellInColumn(table: HTMLTableElement, rowLabel: string, columnHeader: string): HTMLElement {
  const headers = [...table.querySelectorAll('[role="columnheader"], thead th')].map((h) => normalizeText(h.textContent));
  const colIndex = headers.findIndex((h) => h === columnHeader || h.startsWith(columnHeader));
  expect(colIndex).toBeGreaterThanOrEqual(0);
  const rows = [...table.querySelectorAll("tbody tr, tbody [role='row']")];
  const targetRow = rows.find((row) => {
    const rowHeader = row.querySelector('[role="rowheader"], th[scope="row"]');
    return normalizeText(rowHeader?.textContent).includes(rowLabel);
  });
  expect(targetRow).toBeDefined();
  const cells = [...targetRow!.querySelectorAll("th, td, [role='rowheader'], [role='cell']")];
  const cell = cells[colIndex];
  expect(cell).toBeDefined();
  return cell as HTMLElement;
}

function buildArenaData(options: { includeWilson?: boolean; includeMoreScores?: boolean; includeCrpsOnly?: boolean } = {}): ArenaData {
  const { includeWilson = true, includeMoreScores = true, includeCrpsOnly = false } = options;
  return {
    schema_version: 1,
    information_date: "2026-11-20",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Fixture A", kind: "baseline", note: "Baseline." },
      { id: "ar", label: "Fixture B", kind: "classical", note: "Autoregression." },
      { id: "ridge", label: "Fixture C", kind: "classical", note: "Ridge." },
    ],
    forecasts: [
      {
        target: "gdp",
        period: "2025-01-01",
        made_on: "2025-02-15",
        actual: 1.0,
        values: { naive: 0.5, ar: 0.9, ridge: 1.1 },
        intervals: { naive: { level: 0.9, lo: 0, hi: 2 }, ar: null, ridge: null },
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
        coverage_90: 0.875,
        dm_vs_naive_p: null,
        n_intervals: includeWilson ? 40 : null,
        coverage_90_lo: includeWilson ? 0.779 : null,
        coverage_90_hi: includeWilson ? 0.941 : null,
        pinball_05: includeMoreScores ? 0.1234 : null,
        pinball_50: includeMoreScores ? 0.3456 : null,
        pinball_95: includeMoreScores ? 0.1789 : null,
        aci_n: includeMoreScores ? 32 : null,
        aci_coverage_90: includeMoreScores ? 0.85 : null,
        crps: includeMoreScores || includeCrpsOnly ? 0.4123 : null,
        crps_n: includeMoreScores || includeCrpsOnly ? 40 : null,
      },
      {
        target: "gdp",
        contestant: "ar",
        window: "all",
        n: 1,
        mae: 0.4,
        rmse: 0.4,
        coverage_90: 1,
        dm_vs_naive_p: 0.25,
        n_intervals: includeWilson ? 1 : null,
        coverage_90_lo: includeWilson ? 0.207 : null,
        coverage_90_hi: includeWilson ? 1 : null,
        pinball_05: includeMoreScores ? 0.05 : null,
        pinball_50: includeMoreScores ? 0.42 : null,
        pinball_95: includeMoreScores ? null : null,
        aci_n: includeMoreScores ? null : null,
        aci_coverage_90: includeMoreScores ? null : null,
        crps: null,
        crps_n: null,
      },
      {
        target: "gdp",
        contestant: "ridge",
        window: "all",
        n: 20,
        mae: 0.7,
        rmse: 0.9,
        coverage_90: 0.5,
        dm_vs_naive_p: 0.5,
        n_intervals: null,
        coverage_90_lo: null,
        coverage_90_hi: null,
        pinball_05: null,
        pinball_50: null,
        pinball_95: null,
        aci_n: null,
        aci_coverage_90: null,
        crps: null,
        crps_n: null,
      },
      {
        target: "cpi",
        contestant: "naive",
        window: "all",
        n: 12,
        mae: 0.3,
        rmse: 0.4,
        coverage_90: 0.75,
        dm_vs_naive_p: null,
        n_intervals: null,
        coverage_90_lo: null,
        coverage_90_hi: null,
        pinball_05: null,
        pinball_50: null,
        pinball_95: null,
        aci_n: null,
        aci_coverage_90: null,
        crps: null,
        crps_n: null,
      },
    ],
    leakage: [],
    live: [{ target: "gdp", period: "2026-10-01", as_of: "2026-11-15", values: { naive: 1.0 } }],
    nested_tests: [],
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

describe("Arena leaderboard Wilson coverage and More scores section", () => {
  it("renders Wilson intervals with singular and plural forecast labels when present and leaves cells unchanged when absent", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: true, includeMoreScores: false }));
    await act(async () => root.render(createElement(Arena)));

    const leaderboard = findTableWithHeaders(["RMSE", "90% coverage"]);
    expect(leaderboard).not.toBeNull();

    const naiveCoverage = normalizeText(cellInColumn(leaderboard!, "Fixture A", "90% coverage").textContent);
    expect(naiveCoverage).toContain("87.5%");
    expect(naiveCoverage).toContain("95% interval 78% to 94%, 40 forecasts");

    const arCoverage = normalizeText(cellInColumn(leaderboard!, "Fixture B", "90% coverage").textContent);
    expect(arCoverage).toContain("100.0%");
    expect(arCoverage).toContain("95% interval 21% to 100%, 1 forecast");
    expect(arCoverage).not.toContain("1 forecasts");

    const ridgeCoverage = normalizeText(cellInColumn(leaderboard!, "Fixture C", "90% coverage").textContent);
    expect(ridgeCoverage).toContain("50.0%");
    expect(ridgeCoverage).not.toContain("95% interval");

    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: false, includeMoreScores: false }));
    await act(async () => root.render(createElement(Arena)));

    const legacyLeaderboard = findTableWithHeaders(["RMSE", "90% coverage"]);
    expect(legacyLeaderboard).not.toBeNull();
    const legacyNaiveCoverage = normalizeText(cellInColumn(legacyLeaderboard!, "Fixture A", "90% coverage").textContent);
    expect(legacyNaiveCoverage).toBe("87.5%");
    expect(legacyNaiveCoverage).not.toContain("95% interval");
  });

  it("renders More scores inside the leaderboard section, closed by default, with HowToRead, columns, and Not available values, leaving the rail unchanged", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: true, includeMoreScores: true }));
    await act(async () => root.render(createElement(Arena)));

    const railNav = host.querySelector('nav[aria-label="On this page"]');
    expect(railNav).not.toBeNull();
    const railLabels = [...railNav!.querySelectorAll("a")].map((link) => normalizeText(link.textContent));
    expect(railLabels).toEqual(["Top", "Leaderboard", "History", "Leakage", "Next release", "How to read"]);

    const leaderboardHeading = [...host.querySelectorAll("h1, h2, h3, [role='heading']")]
      .find((h) => normalizeText(h.textContent) === "Forecast leaderboard");
    expect(leaderboardHeading).toBeDefined();
    const leaderboardSection = leaderboardHeading!.closest("section");
    expect(leaderboardSection).not.toBeNull();

    const moreDetails = findDetailsBySummary("More scores: pinball loss and adaptive coverage");
    expect(moreDetails).not.toBeNull();
    expect(leaderboardSection!.contains(moreDetails)).toBe(true);
    expect(moreDetails!.open).toBe(false);

    const leaderboard = findTableWithHeaders(["RMSE", "90% coverage"])!;
    expect(Boolean(leaderboard.compareDocumentPosition(moreDetails!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    const summary = findSummaryByText("More scores: pinball loss and adaptive coverage")!;
    await act(async () => summary.click());
    expect(moreDetails!.open).toBe(true);

    const howToReadSummary = [...moreDetails!.querySelectorAll("summary")]
      .find((el) => normalizeText(el.textContent) === "How to read this table");
    expect(howToReadSummary).toBeDefined();

    const moreTable = [...moreDetails!.querySelectorAll<HTMLTableElement>('[role="table"], table')][0];
    expect(moreTable).toBeDefined();
    expect(Boolean(howToReadSummary!.compareDocumentPosition(moreTable!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    const howToReadDetails = howToReadSummary!.closest("details")!;
    const howToReadText = normalizeText(howToReadDetails.textContent);
    expect(howToReadText).toMatch(/pinball/i);
    expect(howToReadText).toContain("CRPS scores the whole range of a forecast at once, in the unit of the number: a smaller value means the whole range sat closer to what happened.");
    expect(howToReadText).toMatch(/adaptive/i);
    expect(howToReadText).toMatch(/few|dozen|close|separate/i);

    const headers = [...moreTable!.querySelectorAll('[role="columnheader"], thead th')].map((h) => normalizeText(h.textContent));
    expect(headers).toHaveLength(7);
    expect(headers[0]).toBe("Contestant");
    expect(headers[1]).toBe("Pinball 5%");
    expect(headers[2]).toBe("Pinball 50%");
    expect(headers[3]).toBe("Pinball 95%");
    expect(headers[4]).toBe("Adaptive coverage");
    expect(headers[5]).toMatch(/^Forecasts scored/);
    expect(headers[6]).toBe("CRPS");

    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "Pinball 5%").textContent)).toBe("0.12");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "Pinball 50%").textContent)).toBe("0.35");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "Pinball 95%").textContent)).toBe("0.18");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "Adaptive coverage").textContent)).toMatch(/^(85(\.0)?%|0\.85)$/);
    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "Forecasts scored").textContent)).toMatch(/^32(\.00)?$/);
    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "CRPS").textContent)).toBe("0.41");

    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "Pinball 5%").textContent)).toBe("0.05");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "Pinball 50%").textContent)).toBe("0.42");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "Pinball 95%").textContent)).toBe("Not available");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "Adaptive coverage").textContent)).toBe("Not available");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "Forecasts scored").textContent)).toBe("Not available");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "CRPS").textContent)).toBe("Not available");

    expect(normalizeText(cellInColumn(moreTable!, "Fixture C", "Pinball 5%").textContent)).toBe("Not available");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture C", "CRPS").textContent)).toBe("Not available");
  });

  it("renders More scores when only CRPS is present and never adds CRPS to the leaderboard", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: true, includeMoreScores: false, includeCrpsOnly: true }));
    await act(async () => root.render(createElement(Arena)));

    const leaderboard = findTableWithHeaders(["RMSE", "90% coverage"])!;
    const leaderboardHeaders = [...leaderboard.querySelectorAll('[role="columnheader"], thead th')].map((h) => normalizeText(h.textContent));
    expect(leaderboardHeaders).not.toContain("CRPS");

    const moreDetails = findDetailsBySummary("More scores: pinball loss and adaptive coverage");
    expect(moreDetails).not.toBeNull();
    const moreTable = [...moreDetails!.querySelectorAll<HTMLTableElement>('[role="table"], table')][0]!;
    expect(normalizeText(cellInColumn(moreTable, "Fixture A", "CRPS").textContent)).toBe("0.41");
    expect(normalizeText(cellInColumn(moreTable, "Fixture B", "CRPS").textContent)).toBe("Not available");
  });

  it("does not render More scores when the selected target has no pinball or adaptive coverage fields", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: true, includeMoreScores: false }));
    await act(async () => root.render(createElement(Arena)));
    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).toBeNull();

    await act(async () => root.unmount());
    root = createRoot(host);
    vi.mocked(loadArena).mockResolvedValueOnce(buildArenaData({ includeWilson: true, includeMoreScores: true }));
    await act(async () => root.render(createElement(Arena)));
    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).not.toBeNull();

    const cpiRadio = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      .find((btn) => normalizeText(btn.textContent).includes("Inflation"));
    expect(cpiRadio).toBeDefined();
    await act(async () => cpiRadio!.click());
    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).toBeNull();
  });
});
