// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REACTIONS_NOT_BUILT, loadReactions, type ReactionsData } from "../data/reactions";
import { Reactions } from "./Reactions";
import { Revisions } from "./Revisions";
import { loadRevisions } from "../data/load";

vi.mock("../data/reactions", async () => {
  const actual = await vi.importActual<typeof import("../data/reactions")>("../data/reactions");
  return { ...actual, loadReactions: vi.fn() };
});

vi.mock("../data/load", async () => {
  const actual = await vi.importActual<typeof import("../data/load")>("../data/load");
  return { ...actual, loadRevisions: vi.fn() };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let host: HTMLDivElement;
let root: Root;

const FIXTURE: ReactionsData = {
  schema_version: 1,
  units: {
    gdp: "annualized percent q/q",
    cpi: "percent m/m",
    payrolls: "thousands of jobs",
  },
  rows: [
    {
      target: "gdp",
      period: "2025-01-01",
      release_date: "2025-04-30",
      first_print: 2.3,
      benchmark: 2.0,
      benchmark_kind: "survey",
      surprise: 0.3,
      d2y_bp: 4.0,
      d10y_bp: 2.0,
    },
    {
      target: "gdp",
      period: "2025-04-01",
      release_date: "2025-07-30",
      first_print: 1.5,
      benchmark: 1.8,
      benchmark_kind: "models",
      surprise: -0.3,
      d2y_bp: -3.0,
      d10y_bp: -1.0,
    },
    ...Array.from({ length: 10 }, (_, idx) => {
      const surprise = Number((-0.45 + idx * 0.1).toFixed(2));
      return {
        target: "cpi" as const,
        period: `2025-${String(idx + 1).padStart(2, "0")}-01`,
        release_date: `2025-${String(idx + 1).padStart(2, "0")}-12`,
        first_print: Number((0.3 + surprise).toFixed(2)),
        benchmark: 0.3,
        benchmark_kind: "models" as const,
        surprise,
        d2y_bp: Number((surprise * 20).toFixed(1)),
        d10y_bp: Number((surprise * 10).toFixed(1)),
      };
    }),
  ],
  summary: [
    {
      target: "gdp",
      n: 2,
      corr_2y: null,
      corr_10y: null,
      slope_10y_bp_per_unit: null,
      p_10y: null,
    },
    {
      target: "cpi",
      n: 10,
      corr_2y: 1.0,
      corr_10y: 1.0,
      slope_10y_bp_per_unit: 10.0,
      p_10y: 0.0,
    },
    {
      target: "payrolls",
      n: 0,
      corr_2y: null,
      corr_10y: null,
      slope_10y_bp_per_unit: null,
      p_10y: null,
    },
  ],
};

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(loadReactions).mockReset().mockResolvedValue(FIXTURE);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Reactions page", () => {
  it("shows a not built message when reactions.json is missing", async () => {
    vi.mocked(loadReactions).mockRejectedValueOnce(new Error(REACTIONS_NOT_BUILT));
    await act(async () => {
      root.render(createElement(Reactions));
    });
    await flush();
    expect(host.textContent).toContain("Do surprises move interest rates?");
    expect(host.textContent).toContain(REACTIONS_NOT_BUILT);
  });

  it("renders thin, full and empty target states, toggles 2-year yield and formats p=0", async () => {
    await act(async () => {
      root.render(createElement(Reactions));
    });
    await flush();

    expect(host.querySelector("h1")?.textContent).toBe("Do surprises move interest rates?");
    expect(host.textContent).toContain("Reactions");
    expect(host.textContent).toContain("Too few releases to draw a line.");
    expect(host.querySelectorAll(".reactions-dot")).toHaveLength(2);
    expect(host.querySelector('line[stroke-dasharray="6 4"]')).toBeNull();

    const buttons = [...host.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    const cpiBtn = buttons.find((b) => b.textContent?.includes("Inflation"))!;
    await act(async () => {
      cpiBtn.click();
    });
    expect(host.textContent).not.toContain("Too few releases to draw a line.");
    expect(host.querySelectorAll(".reactions-dot")).toHaveLength(10);
    expect(host.querySelector('line[stroke-dasharray="6 4"]')).not.toBeNull();
    expect(host.textContent).toContain("less than 0.0001");
    expect(host.textContent).toContain("10-year yield change (bp)");

    const twoYearBtn = [...host.querySelectorAll<HTMLButtonElement>(".reactions-yield-switch button")]
      .find((b) => b.textContent?.includes("2-year"))!;
    await act(async () => {
      twoYearBtn.click();
    });
    expect(host.textContent).toContain("2-year yield change (bp)");

    const payrollsBtn = buttons.find((b) => b.textContent?.includes("Payrolls"))!;
    await act(async () => {
      payrollsBtn.click();
    });
    expect(host.textContent).toContain("No release reactions are available for Payrolls yet.");
    expect(host.querySelectorAll(".reactions-dot")).toHaveLength(0);
  });

  it("links from the bottom of the Revisions page", async () => {
    vi.mocked(loadRevisions).mockResolvedValueOnce({
      schema_version: 1,
      settled_months: 6,
      series: [
        {
          series: "payrolls",
          label: "Payrolls",
          unit: "jobs",
          resolution: 1000,
          latest_vintage: "2026-10-02",
          n: 10,
          mean_revision: 0,
          mean_abs_revision: 30000,
          mean_abs_next: 20000,
          mean_abs_first: 150000,
          share_up: 0.5,
          share_down: 0.5,
          biggest: [],
          points: [],
        },
      ],
    });
    await act(async () => {
      root.render(createElement(Revisions));
    });
    await flush();
    const link = [...host.querySelectorAll<HTMLAnchorElement>("a")]
      .find((a) => a.textContent?.includes("See how rates reacted"));
    expect(link).toBeDefined();
    expect(link?.getAttribute("href")).toBe("?page=reactions");
  });
});
