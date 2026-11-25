// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { navigationFor } from "../lib/navigation";
import { pageSearch, parseUrlState } from "../lib/url";
import { Reactions } from "./Reactions";
import { Revisions } from "./Revisions";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildReactionsPayload() {
  const gdpRows = Array.from({ length: 10 }, (_, idx) => {
    const month = String((idx % 4) * 3 + 1).padStart(2, "0");
    const year = 2022 + Math.floor(idx / 4);
    const surprise = Number(((idx - 4.5) * 0.2).toFixed(4));
    return {
      target: "gdp",
      period: `${year}-${month}-01`,
      release_date: `${year}-${month}-28`,
      first_print: Number((2.0 + surprise).toFixed(4)),
      benchmark: 2.0,
      benchmark_kind: "survey",
      surprise,
      d2y_bp: Number((surprise * 4).toFixed(4)),
      d10y_bp: Number((surprise * 6).toFixed(4)),
    };
  });

  const cpiRows = [
    {
      target: "cpi",
      period: "2025-01-01",
      release_date: "2025-02-12",
      first_print: 0.5,
      benchmark: 0.3,
      benchmark_kind: "models",
      surprise: 0.2,
      d2y_bp: 7.0,
      d10y_bp: 5.0,
    },
    {
      target: "cpi",
      period: "2025-02-01",
      release_date: "2025-03-12",
      first_print: 0.2,
      benchmark: 0.3,
      benchmark_kind: "models",
      surprise: -0.1,
      d2y_bp: -3.0,
      d10y_bp: -2.0,
    },
  ];

  return {
    schema_version: 1,
    rows: [...gdpRows, ...cpiRows],
    summary: [
      { target: "gdp", n: 10, corr_2y: 0.65, corr_10y: 0.72, slope_10y_bp_per_unit: 6.0, p_10y: 0.0 },
      { target: "cpi", n: 2, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
      { target: "payrolls", n: 0, corr_2y: null, corr_10y: null, slope_10y_bp_per_unit: null, p_10y: null },
    ],
    units: {
      gdp: "annualized percent q/q",
      cpi: "percent m/m",
      payrolls: "thousands of jobs",
    },
  };
}

function stubReactionsFetch(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(status === 404 ? null : JSON.stringify(payload), { status })),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Reactions page contract", () => {
  it("renders title, kicker, PageGuide, target switch, scatter, 2y toggle, HowToRead and summary table", async () => {
    stubReactionsFetch(buildReactionsPayload());
    await act(async () => root.render(createElement(Reactions)));

    const h1 = host.querySelector("h1");
    expect(normalizeText(h1?.textContent)).toBe("Do surprises move interest rates?");
    expect(normalizeText(host.textContent)).toContain("Reactions");

    const guide = host.querySelector('dl[aria-label="About this page"]');
    expect(guide).not.toBeNull();
    expect(normalizeText(guide?.textContent)).toMatch(/few|other news|no cause|investment advice/i);

    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]')];
    expect(radios.map((r) => normalizeText(r.textContent)).join(" | ")).toContain("GDP growth");
    expect(radios.map((r) => normalizeText(r.textContent)).join(" | ")).toContain("Inflation");
    expect(radios.map((r) => normalizeText(r.textContent)).join(" | ")).toContain("Payrolls");

    const svg = host.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(normalizeText(svg?.textContent)).toContain("annualized percent q/q");
    expect(normalizeText(svg?.textContent)).toMatch(/bp|basis points/i);

    const howToReadSummary = [...host.querySelectorAll("summary")]
      .find((s) => normalizeText(s.textContent) === "How to read this chart");
    expect(howToReadSummary).toBeDefined();

    // Points are focusable or an equivalent table of releases is rendered below the chart.
    const focusableSvgPoints = svg!.querySelectorAll("a[href], [tabindex]");
    const tables = [...host.querySelectorAll("table")];
    expect(tables.length).toBeGreaterThanOrEqual(1);
    expect(focusableSvgPoints.length >= 10 || tables.length >= 2).toBe(true);

    // Summary table shows n=10, correlation, slope, and "less than 0.0001" for stored p_10y === 0.
    const bodyText = normalizeText(host.textContent);
    expect(bodyText).toContain("10");
    expect(bodyText).toContain("0.72");
    expect(bodyText).toContain("less than 0.0001");
    expect(bodyText).not.toContain("Too few releases to draw a line.");
    expect(bodyText).not.toMatch(/statistically significant|best forecaster|winner/i);

    // Switch to 2-year yield change.
    const twoYearControl = [...host.querySelectorAll<HTMLButtonElement>("button, [role='radio'], [role='tab']")]
      .find((el) => /2[- ]?year/i.test(normalizeText(el.textContent)));
    expect(twoYearControl).toBeDefined();
    await act(async () => twoYearControl!.click());
    expect(normalizeText(host.textContent)).toMatch(/2[- ]?year/i);
  });

  it("shows thin and empty states when switching targets", async () => {
    stubReactionsFetch(buildReactionsPayload());
    await act(async () => root.render(createElement(Reactions)));

    const radios = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const cpiRadio = radios.find((r) => normalizeText(r.textContent).includes("Inflation"))!;
    await act(async () => cpiRadio.click());

    expect(host.querySelector('svg[role="img"]')).not.toBeNull();
    expect(normalizeText(host.textContent)).toContain("Too few releases to draw a line.");

    const payrollsRadio = radios.find((r) => normalizeText(r.textContent).includes("Payrolls"))!;
    await act(async () => payrollsRadio.click());

    expect(host.querySelector('svg[role="img"]')).toBeNull();
    expect(normalizeText(host.textContent)).not.toContain("Too few releases to draw a line.");
    expect(normalizeText(host.textContent)).toMatch(/no .*releases|no rows|no data|unavailable/i);
  });

  it("shows a not built yet message when reactions.json returns 404", async () => {
    stubReactionsFetch(null, 404);
    await act(async () => root.render(createElement(Reactions)));
    expect(normalizeText(host.textContent)).toMatch(/not.*built/i);
    expect(host.querySelector('svg[role="img"]')).toBeNull();
  });

  it("registers the reactions route, public learn navigation, App title, and Revisions link", async () => {
    expect(pageSearch("reactions")).toBe("?page=reactions");
    expect(parseUrlState("?page=reactions").page).toBe("reactions");

    const nav = navigationFor(true);
    expect(nav.learn).toContainEqual(["reactions", "Reactions"]);
    expect(nav.primary.some(([page]) => page === "reactions")).toBe(false);

    vi.stubEnv("VITE_EDITION", "public");
    stubReactionsFetch(buildReactionsPayload());
    window.history.replaceState(null, "", "/?page=reactions");
    await act(async () => root.render(createElement(App)));
    expect(normalizeText(host.querySelector("h1")?.textContent)).toBe("Do surprises move interest rates?");
    expect(document.title).toContain("Do surprises move interest rates?");

    await act(async () => root.unmount());
    root = createRoot(host);

    const revisionsPayload = {
      schema_version: 1,
      settled_months: 6,
      series: [
        {
          series: "payrolls",
          label: "Payrolls",
          unit: "jobs",
          resolution: 1000,
          latest_vintage: "2025-03-07",
          n: 1,
          mean_revision: 5000,
          mean_abs_revision: 5000,
          mean_abs_next: 2000,
          share_up: 1,
          share_down: 0,
          mean_abs_first: 150000,
          biggest: [{ period: "2024-01-01", first: 150000, latest: 155000 }],
          points: [{ period: "2024-01-01", first: 150000, next: 152000, latest: 155000, settled: true }],
        },
      ],
    };
    stubReactionsFetch(revisionsPayload);
    await act(async () => root.render(createElement(Revisions)));
    const reactionsLink = [...host.querySelectorAll<HTMLAnchorElement>("a")]
      .find((a) => a.getAttribute("href") === "?page=reactions");
    expect(reactionsLink).toBeDefined();
    expect(normalizeText(reactionsLink?.textContent)).toContain("See how rates reacted");
  });
});
