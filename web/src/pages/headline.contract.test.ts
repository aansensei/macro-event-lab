// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadArena, type Arena as ArenaData, type ArenaForecast } from "../data/arena";
import { loadBriefing, type Briefing } from "../data/briefing";
import { loadLedgerSummary } from "../data/ledger";
import { loadRevisions } from "../data/load";
import { loadNowcast, type Nowcast } from "../data/nowcast";
import { loadStatus } from "../data/status";
import type { Revisions } from "../data/types";
import { aboutCopyFor } from "../lib/aboutCopy";
import { Arena } from "./Arena";
import { PublicHome } from "./PublicHome";

vi.mock("../data/arena", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/arena")>()),
  loadArena: vi.fn(),
}));
vi.mock("../data/briefing", () => ({ loadBriefing: vi.fn() }));
vi.mock("../data/ledger", () => ({ loadLedgerSummary: vi.fn() }));
vi.mock("../data/load", () => ({ loadRevisions: vi.fn() }));
vi.mock("../data/nowcast", () => ({
  loadNowcast: vi.fn(),
  nowcastErrors: () => ({ model: 1.1, naive: 2.2, n: 10 }),
}));
vi.mock("../data/status", () => ({ loadStatus: vi.fn() }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SENTENCE_REVISIONS =
  "On average a payrolls figure changes by this much between its first publication and today.";
const SENTENCE_GDP =
  "On GDP growth, over the same quarters, here is how far the survey and the naive forecast were from the first published number.";
const SENTENCE_UNCERTAINTY =
  "A forecast range that promises 90 percent held the real inflation number about this often.";
const ALL_SENTENCES = [SENTENCE_REVISIONS, SENTENCE_GDP, SENTENCE_UNCERTAINTY];

const BANNED_CARD_WORDS = /\b(best|winner|wins|beats|loses|ranks)\b/i;

const ROADMAP_BANNER = "Results describe the periods available so far and rank nobody.";
const ROADMAP_BOTTOM =
  "Planned and not yet run: two time series foundation models, which are part of the evaluation protocol and will be added as they run.";

let host: HTMLDivElement;
let root: Root;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function quarterPeriod(index: number): string {
  const year = 2015 + Math.floor(index / 4);
  const month = String((index % 4) * 3 + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

// Hand computed GDP shared quarters:
// 16 rows: actual = 2.0, spf = 1.0 (sq error 1.0), naive = 5.0 (sq error 9.0)
//  9 rows: actual = 3.0, spf = 1.0 (sq error 4.0), naive = 7.0 (sq error 16.0)
// Total shared quarters = 25 (at least 20).
// spf MSE = (16 * 1 + 9 * 4) / 25 = 52 / 25 = 2.08 -> sqrt(2.08) = 1.4422205 -> 1.4
// naive MSE = (16 * 9 + 9 * 16) / 25 = 288 / 25 = 11.52 -> sqrt(11.52) = 3.3941125 -> 3.4
function buildGdpForecasts(sharedCount: number): ArenaForecast[] {
  const rows: ArenaForecast[] = [];
  for (let i = 0; i < sharedCount; i += 1) {
    const isLarge = i >= 16;
    rows.push({
      target: "gdp",
      period: quarterPeriod(i),
      made_on: quarterPeriod(i),
      actual: isLarge ? 3.0 : 2.0,
      values: { spf: 1.0, naive: isLarge ? 7.0 : 5.0 },
      intervals: {},
    });
  }
  // Excluded rows: missing spf, missing actual, missing naive.
  // Large values here prove the calculation filters to shared rows with known actuals.
  rows.push({
    target: "gdp",
    period: quarterPeriod(sharedCount),
    made_on: quarterPeriod(sharedCount),
    actual: 2.0,
    values: { spf: null, naive: 102.0 },
    intervals: {},
  });
  rows.push({
    target: "gdp",
    period: quarterPeriod(sharedCount + 1),
    made_on: quarterPeriod(sharedCount + 1),
    actual: null,
    values: { spf: 1.0, naive: 1.0 },
    intervals: {},
  });
  rows.push({
    target: "gdp",
    period: quarterPeriod(sharedCount + 2),
    made_on: quarterPeriod(sharedCount + 2),
    actual: 2.0,
    values: { spf: 50.0, naive: null },
    intervals: {},
  });
  return rows;
}

function buildArena(options: {
  sharedGdpCount?: number;
  cpiCalN?: number;
  cpiCalCoverage?: number;
  includeCpiCal?: boolean;
} = {}): ArenaData {
  const {
    sharedGdpCount = 25,
    cpiCalN = 142,
    cpiCalCoverage = 0.864,
    includeCpiCal = true,
  } = options;
  return {
    schema_version: 1,
    information_date: "2026-11-24",
    targets: [
      { id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" },
      { id: "cpi", label: "Inflation", unit: "percent m/m", frequency: "monthly" },
      { id: "payrolls", label: "Payrolls", unit: "thousands of jobs", frequency: "monthly" },
    ],
    contestants: [
      { id: "naive", label: "Naive", kind: "baseline", note: "Previous print." },
      { id: "ar", label: "Autoregression", kind: "classical", note: "AR model." },
      { id: "spf", label: "Survey median", kind: "human", note: "SPF median." },
    ],
    forecasts: buildGdpForecasts(sharedGdpCount),
    // Deliberately bogus rounded scores so reading arena.scores fails the contract test.
    scores: [
      { target: "gdp", contestant: "naive", window: "all", n: 99, mae: 8.0, rmse: 8.8, coverage_90: 0.7, dm_vs_naive_p: null },
      { target: "gdp", contestant: "spf", window: "all", n: 99, mae: 9.0, rmse: 9.9, coverage_90: null, dm_vs_naive_p: 0.5 },
      { target: "cpi", contestant: "naive", window: "all", n: 50, mae: 0.2, rmse: 0.3, coverage_90: 0.9, dm_vs_naive_p: null },
    ],
    leakage: [],
    live: [],
    calibration: includeCpiCal
      ? [
          { target: "cpi", contestant: "naive", level: 0.5, n: 200, coverage: 0.55, coverage_lo: 0.48, coverage_hi: 0.62 },
          { target: "gdp", contestant: "naive", level: 0.9, n: 80, coverage: 0.72, coverage_lo: 0.61, coverage_hi: 0.81 },
          { target: "cpi", contestant: "ar", level: 0.9, n: 150, coverage: 0.98, coverage_lo: 0.94, coverage_hi: 0.99 },
          { target: "cpi", contestant: "naive", level: 0.9, n: cpiCalN, coverage: cpiCalCoverage, coverage_lo: 0.8, coverage_hi: 0.91 },
        ]
      : [],
  };
}

// Hand computed revisions figure:
// mean_abs_revision = 68499 jobs -> 68499 / 1000 = 68.499 -> rounded whole thousand = 68
function buildRevisions(options: { payrollsN?: number; meanAbsRevision?: number | null; includePayrolls?: boolean } = {}): Revisions {
  const { payrollsN = 24, meanAbsRevision = 68499, includePayrolls = true } = options;
  return {
    schema_version: 1,
    settled_months: 24,
    series: [
      ...(includePayrolls
        ? [{
            series: "payrolls" as const,
            label: "Jobs",
            unit: "jobs",
            resolution: 1000,
            latest_vintage: "2026-10-02",
            n: payrollsN,
            mean_revision: 1200,
            mean_abs_revision: meanAbsRevision,
            mean_abs_next: 40000,
            share_up: 0.55,
            share_down: 0.45,
            mean_abs_first: 150000,
            biggest: [],
            points: [{ period: "2024-01-01", first: 100000, next: 120000, latest: 168499, settled: true }],
          }]
        : []),
      {
        series: "gdp",
        label: "GDP",
        unit: "% annualized",
        resolution: 0.1,
        latest_vintage: "2026-10-02",
        n: 40,
        mean_revision: 0.1,
        mean_abs_revision: 1.2,
        mean_abs_next: 0.5,
        share_up: 0.5,
        share_down: 0.5,
        mean_abs_first: 2.5,
        biggest: [],
        points: [{ period: "2024-01-01", first: 2.0, next: 2.2, latest: 2.5, settled: true }],
      },
    ],
  };
}

const BRIEFING: Briefing = { schema_version: 1, information_date: "2026-11-24", releases: [] };
const NOWCAST: Nowcast = {
  source: "ALFRED",
  schema_version: 1,
  points: [],
  coefficients: [],
  live: { reference_period: "2026-10-01", as_of: "2026-11-24", nowcast: 2.4, months_published: 1, missing: [] },
};

function findCardBySentence(sentence: string): HTMLElement | null {
  const leaf = [...host.querySelectorAll<HTMLElement>("*")]
    .filter((el) => normalizeText(el.textContent).includes(sentence))
    .pop();
  if (!leaf) return null;
  let current: HTMLElement | null = leaf;
  const others = ALL_SENTENCES.filter((item) => item !== sentence);
  while (current && current !== host) {
    const text = normalizeText(current.textContent);
    const hasOther = others.some((item) => text.includes(item));
    if (hasOther) return null;
    if (current.querySelector('a[href^="?page="]') || (current.tagName === "A" && current.getAttribute("href")?.startsWith("?page="))) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function findHeadingElement(text: string): HTMLElement | null {
  return [...host.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, [role='heading']")]
    .find((el) => normalizeText(el.textContent) === text) ?? null;
}

function mockHomeResources(arena: ArenaData, revisions: Revisions): void {
  vi.mocked(loadArena).mockResolvedValue(arena);
  vi.mocked(loadRevisions).mockResolvedValue(revisions);
  vi.mocked(loadBriefing).mockResolvedValue(BRIEFING);
  vi.mocked(loadNowcast).mockResolvedValue(NOWCAST);
  vi.mocked(loadLedgerSummary).mockRejectedValue(new Error("not built"));
  vi.mocked(loadStatus).mockRejectedValue(new Error("not built"));
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

describe("HeadlineStrip contract on PublicHome", () => {
  it("renders three computed headline cards right after the lead paragraph and before the release file", async () => {
    mockHomeResources(buildArena(), buildRevisions());
    await act(async () => root.render(createElement(PublicHome)));

    const lead = [...host.querySelectorAll<HTMLElement>("p")]
      .find((p) => normalizeText(p.textContent).includes("This site replays real releases"));
    expect(lead).toBeDefined();

    const releaseHeading = findHeadingElement("Everyone forecasts the number. Who was close, and what did it become?");
    expect(releaseHeading).not.toBeNull();

    const revisionsCard = findCardBySentence(SENTENCE_REVISIONS);
    const gdpCard = findCardBySentence(SENTENCE_GDP);
    const uncertaintyCard = findCardBySentence(SENTENCE_UNCERTAINTY);

    expect(revisionsCard).not.toBeNull();
    expect(gdpCard).not.toBeNull();
    expect(uncertaintyCard).not.toBeNull();

    for (const card of [revisionsCard!, gdpCard!, uncertaintyCard!]) {
      expect(Boolean(lead!.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
      expect(Boolean(card.compareDocumentPosition(releaseHeading!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    }

    // Card 1: Revisions (68499 jobs -> 68 thousand, 24 months, link to revisions)
    const revText = normalizeText(revisionsCard!.textContent);
    expect(revText).toMatch(/\b68\b/);
    expect(revText).toMatch(/thousand/i);
    expect(revText).toContain("24");
    expect(revText).toMatch(/month/i);
    const revLink = revisionsCard!.tagName === "A"
      ? (revisionsCard as HTMLAnchorElement)
      : revisionsCard!.querySelector<HTMLAnchorElement>('a[href="?page=revisions"]');
    expect(revLink).not.toBeNull();
    expect(revLink!.getAttribute("href")).toBe("?page=revisions");
    expect(normalizeText(revLink!.textContent)).toContain("See the evidence");
    expect(revLink!.querySelector("svg")).not.toBeNull();

    // Card 2: Same period GDP comparison (1.4 and 3.4 points, 25 quarters, preliminary, link to arena, no banned words)
    const gdpText = normalizeText(gdpCard!.textContent);
    expect(gdpText).toMatch(/1\.4\s+and\s+3\.4\s+points/i);
    expect(gdpText).toContain("25");
    expect(gdpText).toMatch(/quarter/i);
    expect(gdpText).toMatch(/preliminary/i);
    expect(gdpText).not.toMatch(BANNED_CARD_WORDS);
    const gdpLink = gdpCard!.tagName === "A"
      ? (gdpCard as HTMLAnchorElement)
      : gdpCard!.querySelector<HTMLAnchorElement>('a[href="?page=arena"]');
    expect(gdpLink).not.toBeNull();
    expect(gdpLink!.getAttribute("href")).toBe("?page=arena");
    expect(normalizeText(gdpLink!.textContent)).toContain("See the evidence");
    expect(gdpLink!.querySelector("svg")).not.toBeNull();

    // Card 3: Uncertainty (0.864 -> 86%, 142 releases, link to arena)
    const uncText = normalizeText(uncertaintyCard!.textContent);
    expect(uncText).toContain("86%");
    expect(uncText).toContain("142");
    expect(uncText).toMatch(/release/i);
    const uncLink = uncertaintyCard!.tagName === "A"
      ? (uncertaintyCard as HTMLAnchorElement)
      : uncertaintyCard!.querySelector<HTMLAnchorElement>('a[href="?page=arena"]');
    expect(uncLink).not.toBeNull();
    expect(uncLink!.getAttribute("href")).toBe("?page=arena");
    expect(normalizeText(uncLink!.textContent)).toContain("See the evidence");
    expect(uncLink!.querySelector("svg")).not.toBeNull();

    // All three cards obey banned-words restriction
    for (const card of [revisionsCard!, gdpCard!, uncertaintyCard!]) {
      expect(normalizeText(card.textContent)).not.toMatch(BANNED_CARD_WORDS);
    }
  });

  it("does not repeat the three headline facts in The wider record", async () => {
    mockHomeResources(buildArena(), buildRevisions());
    await act(async () => root.render(createElement(PublicHome)));

    const widerHeading = findHeadingElement("One release is a story. A history is a test.");
    expect(widerHeading).not.toBeNull();
    const widerSection = widerHeading!.closest("section");
    expect(widerSection).not.toBeNull();
    const widerText = normalizeText(widerSection!.textContent);

    expect(widerText).not.toContain("68,499 jobs");
    expect(widerText).not.toMatch(/68\s+thousand/i);
    expect(widerText).not.toContain("1.4 and 3.4 points");
    expect(widerText).not.toContain(SENTENCE_REVISIONS);
    expect(widerText).not.toContain(SENTENCE_GDP);
    expect(widerText).not.toContain(SENTENCE_UNCERTAINTY);
  });

  it("hides individual cards when fewer than 20 observations exist and keeps boundary 20 visible", async () => {
    // Revisions thin (19), GDP at boundary (20), Uncertainty valid (142)
    mockHomeResources(
      buildArena({ sharedGdpCount: 20, cpiCalN: 142 }),
      buildRevisions({ payrollsN: 19 }),
    );
    await act(async () => root.render(createElement(PublicHome)));

    expect(findCardBySentence(SENTENCE_REVISIONS)).toBeNull();
    expect(findCardBySentence(SENTENCE_GDP)).not.toBeNull();
    expect(findCardBySentence(SENTENCE_UNCERTAINTY)).not.toBeNull();
    expect(normalizeText(findCardBySentence(SENTENCE_GDP)!.textContent)).not.toMatch(BANNED_CARD_WORDS);

    // GDP thin (19) and Uncertainty thin (19), Revisions at boundary (20)
    await act(async () => root.unmount());
    root = createRoot(host);
    mockHomeResources(
      buildArena({ sharedGdpCount: 19, cpiCalN: 19 }),
      buildRevisions({ payrollsN: 20 }),
    );
    await act(async () => root.render(createElement(PublicHome)));

    expect(findCardBySentence(SENTENCE_REVISIONS)).not.toBeNull();
    expect(findCardBySentence(SENTENCE_GDP)).toBeNull();
    expect(findCardBySentence(SENTENCE_UNCERTAINTY)).toBeNull();
  });

  it("hides the entire HeadlineStrip when all three cards have missing or thin data", async () => {
    mockHomeResources(
      buildArena({ sharedGdpCount: 5, includeCpiCal: false }),
      buildRevisions({ includePayrolls: false }),
    );
    await act(async () => root.render(createElement(PublicHome)));

    expect(findCardBySentence(SENTENCE_REVISIONS)).toBeNull();
    expect(findCardBySentence(SENTENCE_GDP)).toBeNull();
    expect(findCardBySentence(SENTENCE_UNCERTAINTY)).toBeNull();
    for (const sentence of ALL_SENTENCES) {
      expect(normalizeText(host.textContent)).not.toContain(sentence);
    }
  });
});

describe("Roadmap wording contract", () => {
  it("replaces planned contestant counts in ArenaIntro and adds a Roadmap block above the story link on Arena", async () => {
    vi.mocked(loadArena).mockResolvedValueOnce(buildArena());
    await act(async () => root.render(createElement(Arena)));

    const noteBanner = host.querySelector('[role="note"]');
    expect(noteBanner).not.toBeNull();
    const bannerText = normalizeText(noteBanner!.textContent);
    expect(bannerText).toContain(ROADMAP_BANNER);
    expect(bannerText).toContain("Contestants with a score so far:");
    expect(bannerText).toContain("GDP growth 2");
    expect(bannerText).toContain("Inflation 1");
    expect(bannerText).not.toMatch(/\bof the \d+ planned contestants\b/i);

    const roadmapHeading = findHeadingElement("Roadmap");
    expect(roadmapHeading).not.toBeNull();
    const roadmapBlock = roadmapHeading!.closest("section") ?? roadmapHeading!.parentElement;
    expect(roadmapBlock).not.toBeNull();
    expect(normalizeText(roadmapBlock!.textContent)).toContain(ROADMAP_BOTTOM);

    // the story link only exists in the public edition, so the block is placed after the reading guide instead
    const guide = host.querySelector("#arena-guide");
    expect(guide).not.toBeNull();
    expect(Boolean(guide!.compareDocumentPosition(roadmapBlock!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    const publicAboutText = normalizeText(JSON.stringify(aboutCopyFor(true)));
    expect(publicAboutText).not.toMatch(/\bof the \d+ planned contestants\b/i);
  });
});
