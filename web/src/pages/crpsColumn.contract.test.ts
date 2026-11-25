// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadArena, parseArena, type Arena as ArenaData } from "../data/arena";
import { Arena } from "./Arena";

vi.mock("../data/arena", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/arena")>()),
  loadArena: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

const CRPS_HOW_TO_READ_SENTENCE =
  "CRPS scores the whole range of a forecast at once, in the unit of the number: a smaller value means the whole range sat closer to what happened.";

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
  const colIndex = headers.findIndex((h) => h === columnHeader);
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

function baseRawArena(): Record<string, unknown> {
  return {
    schema_version: 1,
    information_date: "2026-11-25",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Fixture A", kind: "baseline", note: "Baseline." },
      { id: "ar", label: "Fixture B", kind: "classical", note: "Autoregression." },
    ],
    forecasts: [
      {
        target: "gdp",
        period: "2025-01-01",
        made_on: "2025-02-15",
        actual: 1.0,
        values: { naive: 0.5, ar: 0.9 },
        intervals: { naive: { level: 0.9, lo: 0, hi: 2 }, ar: null },
      },
    ],
    scores: [
      {
        target: "gdp",
        contestant: "naive",
        window: "all",
        n: 45,
        mae: 0.8,
        rmse: 1.1,
        coverage_90: 0.85,
        dm_vs_naive_p: null,
        n_intervals: 5,
        coverage_90_lo: 0.3755,
        coverage_90_hi: 0.9638,
        pinball_05: 0.1234,
        pinball_50: 0.3456,
        pinball_95: 0.1789,
        aci_n: 5,
        aci_coverage_90: 0.8,
      },
      {
        target: "gdp",
        contestant: "ar",
        window: "all",
        n: 12,
        mae: 0.4,
        rmse: 0.4,
        coverage_90: null,
        dm_vs_naive_p: 0.25,
        n_intervals: 0,
        coverage_90_lo: null,
        coverage_90_hi: null,
        pinball_05: null,
        pinball_50: null,
        pinball_95: null,
        aci_n: 0,
        aci_coverage_90: null,
      },
    ],
    leakage: [],
    live: [],
  };
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

describe("arena.ts CRPS parsing contract", () => {
  it("defaults absent crps and crps_n to null while still parsing older files", () => {
    const parsed = parseArena(baseRawArena()) as unknown as {
      scores: Record<string, unknown>[];
    };
    for (const row of parsed.scores) {
      expect(row.crps).toBeNull();
      expect(row.crps_n).toBeNull();
    }
  });

  it("reads numeric and null crps and crps_n values including zero", () => {
    const raw = baseRawArena();
    const scores = raw.scores as Record<string, unknown>[];
    scores[0] = { ...scores[0], crps: 0.1842, crps_n: 5 };
    scores[1] = { ...scores[1], crps: 0, crps_n: null };

    const parsed = parseArena(raw) as unknown as {
      scores: Record<string, unknown>[];
    };
    expect(parsed.scores[0]?.crps).toBe(0.1842);
    expect(parsed.scores[0]?.crps_n).toBe(5);
    expect(parsed.scores[1]?.crps).toBe(0);
    expect(parsed.scores[1]?.crps_n).toBeNull();
  });

  it.each([
    ["crps", "0.18"],
    ["crps", NaN],
    ["crps", Infinity],
    ["crps", -Infinity],
    ["crps", {}],
    ["crps_n", "5"],
    ["crps_n", NaN],
    ["crps_n", Infinity],
    ["crps_n", {}],
  ])("rejects wrong typed %s (%#)", (field, badValue) => {
    const raw = baseRawArena();
    const scores = raw.scores as Record<string, unknown>[];
    scores[0] = { ...scores[0], [field]: badValue };
    expect(() => parseArena(raw)).toThrow();
  });
});

describe("MoreScoresTable CRPS column contract", () => {
  it("renders CRPS column and HowToRead sentence inside More scores, with Not available for null CRPS", async () => {
    const raw = baseRawArena();
    const scores = raw.scores as Record<string, unknown>[];
    scores[0] = { ...scores[0], crps: 0.1842, crps_n: 5 };
    scores[1] = { ...scores[1], crps: null, crps_n: null };

    vi.mocked(loadArena).mockResolvedValueOnce(raw as unknown as ArenaData);
    await act(async () => root.render(createElement(Arena)));

    const moreDetails = findDetailsBySummary("More scores: pinball loss and adaptive coverage");
    expect(moreDetails).not.toBeNull();
    expect(moreDetails!.open).toBe(false);

    const summary = findSummaryByText("More scores: pinball loss and adaptive coverage")!;
    await act(async () => summary.click());
    expect(moreDetails!.open).toBe(true);

    const howToReadSummary = [...moreDetails!.querySelectorAll("summary")]
      .find((el) => normalizeText(el.textContent) === "How to read this table");
    expect(howToReadSummary).toBeDefined();
    const howToReadText = normalizeText(howToReadSummary!.closest("details")!.textContent);
    expect(howToReadText).toContain(CRPS_HOW_TO_READ_SENTENCE);

    const moreTable = [...moreDetails!.querySelectorAll<HTMLTableElement>('[role="table"], table')][0];
    expect(moreTable).toBeDefined();
    const moreHeaders = [...moreTable!.querySelectorAll('[role="columnheader"], thead th')]
      .map((h) => normalizeText(h.textContent));
    expect(moreHeaders).toContain("CRPS");

    expect(normalizeText(cellInColumn(moreTable!, "Fixture A", "CRPS").textContent)).toBe("0.18");
    expect(normalizeText(cellInColumn(moreTable!, "Fixture B", "CRPS").textContent)).toBe("Not available");
  });

  it("shows More scores when only CRPS is present, hides it when all fields are null, and keeps CRPS out of leaderboard", async () => {
    const onlyCrpsRaw = baseRawArena();
    onlyCrpsRaw.scores = (onlyCrpsRaw.scores as Record<string, unknown>[]).map((row, idx) => ({
      ...row,
      pinball_05: null,
      pinball_50: null,
      pinball_95: null,
      aci_n: null,
      aci_coverage_90: null,
      crps: idx === 0 ? 0.251 : null,
      crps_n: idx === 0 ? 5 : null,
    }));

    vi.mocked(loadArena).mockResolvedValueOnce(onlyCrpsRaw as unknown as ArenaData);
    await act(async () => root.render(createElement(Arena)));

    const leaderboard = findTableWithHeaders(["RMSE", "90% coverage"]);
    expect(leaderboard).not.toBeNull();
    const leaderboardHeaders = [...leaderboard!.querySelectorAll('[role="columnheader"], thead th')]
      .map((h) => normalizeText(h.textContent));
    expect(leaderboardHeaders.some((h) => h.includes("CRPS"))).toBe(false);
    expect(normalizeText(host.querySelector(".arena-sort-controls")?.textContent)).not.toContain("CRPS");

    const moreDetails = findDetailsBySummary("More scores: pinball loss and adaptive coverage");
    expect(moreDetails).not.toBeNull();
    const moreTable = [...moreDetails!.querySelectorAll<HTMLTableElement>('[role="table"], table')][0]!;
    expect(normalizeText(cellInColumn(moreTable, "Fixture A", "CRPS").textContent)).toBe("0.25");

    await act(async () => root.unmount());
    root = createRoot(host);

    const allNullRaw = baseRawArena();
    allNullRaw.scores = (allNullRaw.scores as Record<string, unknown>[]).map((row) => ({
      ...row,
      pinball_05: null,
      pinball_50: null,
      pinball_95: null,
      aci_n: null,
      aci_coverage_90: null,
      crps: null,
      crps_n: null,
    }));

    vi.mocked(loadArena).mockResolvedValueOnce(allNullRaw as unknown as ArenaData);
    await act(async () => root.render(createElement(Arena)));

    expect(findSummaryByText("More scores: pinball loss and adaptive coverage")).toBeNull();
  });
});
