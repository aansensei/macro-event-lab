import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NowcastChart } from "../components/NowcastChart";
import { loadNowcast, nowcastErrors, parseNowcast } from "./nowcast";

const payload = { source: "ALFRED", schema_version: 1, points: [
  { reference_period: "2025-01-01", release_date: "2025-04-30", as_of: "2025-04-29",
    first_print: 2, nowcast: 1, previous_print: 4 },
  { reference_period: "2025-04-01", release_date: "2025-07-30", as_of: "2025-07-29",
    first_print: 2, nowcast: 3, previous_print: null },
], coefficients: [{ feature: "INDPRO", coef: 0.3, lo: -0.1, hi: 0.6 }] };

it("loads only the ALFRED nowcast file", async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => new Response(JSON.stringify(payload)));
  expect((await loadNowcast(fetcher)).points).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0]?.[0]).toMatch(/data\/nowcast.json$/);
});

it("rejects wrong source, invalid numbers and nonhistorical cutoffs", () => {
  expect(() => parseNowcast({ ...payload, source: "other" })).toThrow();
  expect(() => parseNowcast({ ...payload, points: [{ ...payload.points[0], as_of: "2025-04-30" }] })).toThrow();
  expect(() => parseNowcast({ ...payload, coefficients: [{ feature: "X", coef: NaN, lo: 0, hi: 1 }] })).toThrow();
});

it("reports HTTP errors instead of displaying invented fallback data", async () => {
  await expect(loadNowcast(async () => new Response(null, { status: 404 }))).rejects.toThrow("404");
});

it("compares squared errors on common quarters and sorts the chart chronologically", () => {
  const data = parseNowcast({ ...payload, points: [...payload.points].reverse() });
  expect(data.points[0]!.reference_period).toBe("2025-01-01");
  expect(nowcastErrors(data.points)).toEqual({ n: 1, model: 1, naive: 2 });
  expect(nowcastErrors([])).toBeNull();
});

it("renders two distinct lines with an accessible description and an empty state", () => {
  const html = renderToStaticMarkup(createElement(NowcastChart, { points: parseNowcast(payload).points }));
  expect(html).toContain('role="img"');
  expect(html).toContain("stroke-dasharray");
  expect(html.match(/<path /g)).toHaveLength(2);
  expect(renderToStaticMarkup(createElement(NowcastChart, { points: [] }))).toContain("No evaluated quarters");
});
