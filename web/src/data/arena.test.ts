import { expect, it, vi } from "vitest";

import { loadArena, parseArena } from "./arena";
import { arenaFixture } from "./arenaFixture";

it("accepts nullable data, real zeros and independent empty sections", () => {
  expect(parseArena(arenaFixture)).toEqual(arenaFixture);
  expect(parseArena({ ...arenaFixture, targets: [], contestants: [], forecasts: [], scores: [], leakage: [], live: [] }).targets).toEqual([]);
  expect(parseArena(arenaFixture).forecasts[0]?.actual).toBe(0);
});

it.each([null, [], "fixture", { ...arenaFixture, schema_version: 2 },
  { ...arenaFixture, information_date: "2026-02-30" }, { ...arenaFixture, targets: null },
  { ...arenaFixture, contestants: [null] }, { ...arenaFixture, forecasts: [null] },
  { ...arenaFixture, scores: [null] }, { ...arenaFixture, leakage: [null] }, { ...arenaFixture, live: [null] },
])("rejects malformed roots and records %#", (value) => expect(() => parseArena(value)).toThrow());

it.each([{ id: "unknown" }, { unit: "" }, { frequency: "daily" }])("rejects invalid targets %#", (patch) => {
  expect(() => parseArena({ ...arenaFixture, targets: [{ ...arenaFixture.targets[0], ...patch }] })).toThrow();
});

it.each([{ id: "" }, { kind: "unknown" }, { label: null }, { note: null }])("rejects invalid contestants %#", (patch) => {
  expect(() => parseArena({ ...arenaFixture, contestants: [{ ...arenaFixture.contestants[0], ...patch }] })).toThrow();
});

it.each([
  { target: "unknown" }, { period: "2025-02-30" }, { period: "2025-01-02" },
  { made_on: "2026-11-21" }, { actual: Infinity }, { values: { missing: 1 } },
  { values: { naive: undefined } }, { intervals: { missing: null } },
  { intervals: { naive: { level: 0.5, lo: 0, hi: 1 } } },
  { intervals: { naive: { level: 0.9, lo: 2, hi: 1 } } },
  { intervals: { naive: { level: 0.9, lo: NaN, hi: 1 } } },
])("rejects invalid forecast provenance or intervals %#", (patch) => {
  expect(() => parseArena({ ...arenaFixture, forecasts: [{ ...arenaFixture.forecasts[0], ...patch }] })).toThrow();
});

it("preserves missing interval bounds and unreleased actuals without imputing zero", () => {
  const data = parseArena({ ...arenaFixture, forecasts: [{ ...arenaFixture.forecasts[0], actual: null,
    intervals: { naive: { level: 0.9, lo: null, hi: null } } }] });
  expect(data.forecasts[0]?.actual).toBeNull();
  expect(data.forecasts[0]?.intervals.naive?.lo).toBeNull();
});

it.each([{ target: "unknown" }, { contestant: "missing" }, { window: "unknown" }, { n: -1 },
  { mae: -1 }, { rmse: -1 }, { coverage_90: 1.01 }, { dm_vs_naive_p: -0.1 }, { rmse: undefined },
])("rejects invalid scores %#", (patch) => {
  expect(() => parseArena({ ...arenaFixture, scores: [{ ...arenaFixture.scores[0], ...patch }] })).toThrow();
});

it.each([{ cutoff_rule: "unknown" }, { cutoff: null }, { cutoff: "2025-02-30" },
  { n_before: -1 }, { n_after: null }, { rmse_before: -1 }, { contestant: "missing" },
])("rejects invalid audit data %#", (patch) => {
  expect(() => parseArena({ ...arenaFixture, leakage: [{ ...arenaFixture.leakage[0], ...patch }] })).toThrow();
});

it("accepts no-cutoff records without inventing a date", () => {
  expect(parseArena({ ...arenaFixture, leakage: [{ ...arenaFixture.leakage[0], cutoff_rule: "none", cutoff: null }] }).leakage[0]?.cutoff).toBeNull();
});

it("validates live references and dates", () => {
  const live = { target: "gdp", period: "2026-10-01", as_of: "2026-11-15", values: { naive: 0 } };
  expect(parseArena({ ...arenaFixture, live: [live] }).live[0]?.values.naive).toBe(0);
  expect(() => parseArena({ ...arenaFixture, live: [{ ...live, as_of: "2026-11-21" }] })).toThrow();
  expect(() => parseArena({ ...arenaFixture, live: [{ ...live, values: { unknown: 1 } }] })).toThrow();
});

it.each(["targets", "contestants", "forecasts", "scores", "leakage"] as const)("rejects duplicate %s records", (key) => {
  expect(() => parseArena({ ...arenaFixture, [key]: [...arenaFixture[key], arenaFixture[key][0]] })).toThrow("duplicate");
});

it("orders a copied history without changing the input", () => {
  const value = { ...arenaFixture, forecasts: [...arenaFixture.forecasts].reverse() };
  expect(parseArena(value).forecasts[0]?.period).toBe("2025-01-01");
  expect(value.forecasts[0]?.period).toBe("2025-04-01");
});

it("loads the configured arena path and preserves the missing-file message", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(arenaFixture)));
  expect(await loadArena(request)).toEqual(arenaFixture);
  expect(request).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/arena.json`);
  await expect(loadArena(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })))).rejects.toThrow("The arena has not been built yet");
});
