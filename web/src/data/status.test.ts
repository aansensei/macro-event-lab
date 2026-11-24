import { describe, expect, it, vi } from "vitest";

import { loadStatus, parseStatus } from "./status";
import { statusFixture } from "./statusFixture";

describe("status parsing", () => {
  it("preserves real zeros, source dates and executed outcomes", () => {
    expect(parseStatus(statusFixture)).toEqual(statusFixture);
    expect(parseStatus({ ...statusFixture, sources: [], checks: [] }).sources).toEqual([]);
  });

  it.each([null, [], 1, "fixture", { ...statusFixture, schema_version: 2 },
    { ...statusFixture, information_date: "2026-02-30" },
    { ...statusFixture, information_date: "2026-11-2" },
    { ...statusFixture, generated_at: "2026-02-30T14:30:00Z" },
    { ...statusFixture, generated_at: "2026-11-20T25:30:00Z" },
    { ...statusFixture, generated_at: "2026-11-20T14:30:00+00:00" },
    { ...statusFixture, checks: null },
  ])("rejects unsupported or malformed root input %#", (value) => {
    expect(() => parseStatus(value)).toThrow();
  });

  it.each([
    { id: "unknown" }, { rows: -1 }, { rows: 0.5 }, { rows: Number.POSITIVE_INFINITY },
    { series_count: null }, { max_age_days: -1 }, { is_fresh: "true" }, { is_fresh: false },
    { latest_vintage_date: "2026-11-22", is_fresh: true }, { label: " " },
  ])("rejects invalid source data %#", (patch) => {
    expect(() => parseStatus({ ...statusFixture, sources: [{ ...statusFixture.sources[0], ...patch }] })).toThrow();
  });

  it("preserves a future-date anomaly without marking it fresh", () => {
    const data = parseStatus({ ...statusFixture, sources: [
      { ...statusFixture.sources[0], latest_vintage_date: "2026-11-22", is_fresh: false },
    ] });
    expect(data.sources[0]?.latest_vintage_date).toBe("2026-11-22");
    expect(data.sources[0]?.is_fresh).toBe(false);
  });

  it.each([
    { name: "duplicates_spf_forecasts" }, { name: "unknown" }, { status: "skip" },
    { problems: -1 }, { description: "" }, null,
  ])("rejects invalid check data %#", (patch) => {
    const value = patch === null ? null : { ...statusFixture.checks[0], ...patch };
    expect(() => parseStatus({ ...statusFixture, checks: [value] })).toThrow();
  });

  it("rejects repeated source and check identifiers", () => {
    expect(() => parseStatus({ ...statusFixture, sources: [statusFixture.sources[0], statusFixture.sources[0]] })).toThrow("duplicate");
    expect(() => parseStatus({ ...statusFixture, checks: [statusFixture.checks[0], statusFixture.checks[0]] })).toThrow("duplicate");
  });

  it.each([["2026-11-13", true], ["2026-11-12", false]] as const)("accepts the ALFRED boundary %s", (latest, fresh) => {
    expect(parseStatus({ ...statusFixture, sources: [{ ...statusFixture.sources[0], latest_vintage_date: latest, is_fresh: fresh }] }).sources[0]?.is_fresh).toBe(fresh);
  });

  it.each([["2026-07-23", true], ["2026-07-22", false]] as const)("accepts the survey boundary %s", (latest, fresh) => {
    expect(parseStatus({ ...statusFixture, sources: [{ ...statusFixture.sources[1], latest_vintage_date: latest, is_fresh: fresh }] }).sources[0]?.is_fresh).toBe(fresh);
  });
});

it("loads the status asset through the configured base path", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(statusFixture)));
  expect(await loadStatus(request)).toEqual(statusFixture);
  expect(request).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/status.json`);
});

it.each([404, 503])("reports HTTP %i without fabricating a snapshot", async (status) => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
  await expect(loadStatus(request)).rejects.toThrow(status === 404 ? "has not been built" : "HTTP 503");
});

it("distinguishes network and invalid JSON failures", async () => {
  await expect(loadStatus(vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")))).rejects.toThrow("could not be reached");
  await expect(loadStatus(vi.fn<typeof fetch>().mockResolvedValue(new Response("invalid")))).rejects.toThrow("not valid JSON");
});
