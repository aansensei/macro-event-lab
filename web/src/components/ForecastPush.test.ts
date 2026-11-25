// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { parseArena, type LiveForecastRow } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import { featureName } from "../lib/featureNames";
import { ForecastPush } from "./ForecastPush";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const row: LiveForecastRow = { target: "cpi", period: "2026-11-01", as_of: "2026-11-15", values: { ridge: 2, lasso: 1 },
  contributions: {
    ridge: { baseline: 1, terms: [
      { feature: "LAG_1", value: 2 }, { feature: "LAG_2", value: -1 },
      { feature: "PAYEMS", value: 0 }, { feature: "INDPRO", value: 0.2 },
      { feature: "PCEC96", value: -0.1 }, { feature: "HOUST", value: -0.05 },
      { feature: "UNRATE", value: -0.03 }, { feature: "RRSFS", value: -0.02 },
    ] }, lasso: { baseline: 1, terms: [{ feature: "LAG_1", value: 0 }] },
  } };

it("maps feature names and preserves unknown identifiers", () => {
  expect(featureName("LAG_1")).toBe("The last first published number");
  expect(featureName("GDP_PREV")).toBe("Growth of the previous quarter");
  expect(featureName("UNRATE")).toBe("Unemployment rate");
  expect(featureName("unknown")).toBe("unknown");
});

it("shows six largest terms, groups the rest and switches the selected model", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  await act(async () => root.render(createElement(ForecastPush, { row, unit: "percent m/m" })));
  expect(host.textContent).toContain("What pushes the forecast");
  expect(host.textContent).toContain("Other indicators");
  expect(host.textContent).toContain("Raises the forecast");
  expect(host.textContent).toContain("Lowers the forecast");
  expect(host.textContent).toContain("Baseline plus the terms equals the forecast");
  expect(host.querySelectorAll(".forecast-push-bars li")).toHaveLength(8);
  expect(host.querySelector(".forecast-push-total")?.textContent).toContain("2.000");
  expect(host.querySelector(".how-to-read")?.textContent).toContain("not a cause");
  await act(async () => host.querySelectorAll<HTMLButtonElement>("button")[1]!.click());
  expect(host.querySelector('[aria-pressed="true"]')?.textContent).toBe("LASSO");
  expect(host.textContent).not.toContain("Other indicators");
  expect(host.textContent).toContain("No change");
  await act(async () => root.unmount());
});

it("renders nothing without contributions and handles a LASSO only row", () => {
  expect(renderToStaticMarkup(createElement(ForecastPush, { row: { ...row, contributions: undefined }, unit: "percent" }))).toBe("");
  const html = renderToStaticMarkup(createElement(ForecastPush, { row: { ...row, contributions: { lasso: row.contributions!.lasso! } }, unit: "percent" }));
  expect(html).toContain("LASSO");
  expect(html).not.toContain(">Ridge<");
});

it("parses optional strictly typed contributions and rejects invalid components", () => {
  const arena = { ...arenaFixture, contestants: [...arenaFixture.contestants,
    { id: "ridge", label: "Ridge", kind: "classical", note: "" }, { id: "lasso", label: "LASSO", kind: "classical", note: "" }], live: [row] };
  expect(parseArena(arena).live[0]?.contributions).toEqual(row.contributions);
  expect(() => parseArena({ ...arena, live: [{ ...row, contributions: { ridge: { baseline: "1", terms: [] } } }] })).toThrow(/numeric/);
  expect(() => parseArena({ ...arena, live: [{ ...row, contributions: { naive: { baseline: 1, terms: [] } } }] })).toThrow(/Only Ridge/);
  expect(() => parseArena({ ...arena, live: [{ ...row, contributions: { ridge: { baseline: 1, terms: [{ feature: "x", value: null }] } } }] })).toThrow(/missing/);
});
