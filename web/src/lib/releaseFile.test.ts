import { describe, expect, it } from "vitest";
import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import { formatReleaseValue, pickReleaseCase, releaseSentence } from "./releaseFile";

const arena: Arena = {
  schema_version: 1, information_date: "2026-01-01",
  targets: [{ id: "gdp", label: "GDP growth", unit: "annualized percent q/q", frequency: "quarterly" }],
  contestants: [
    { id: "a", label: "Fixture A", kind: "baseline", note: "" },
    { id: "b", label: "Fixture B", kind: "classical", note: "" },
  ],
  forecasts: [
    { target: "gdp", period: "2020-01-01", made_on: "2020-02-01", actual: 2.0, values: { a: 1.0, b: 3.0 }, intervals: {} },
    { target: "gdp", period: "2020-04-01", made_on: "2020-05-01", actual: -10.0, values: { a: 1.0, b: 2.0 }, intervals: {} },
    { target: "gdp", period: "2020-07-01", made_on: "2020-08-01", actual: null, values: { a: 1.0, b: 2.0 }, intervals: {} },
    { target: "gdp", period: "2020-10-01", made_on: "2020-11-01", actual: 9.0, values: { a: null, b: 2.0 }, intervals: {} },
  ],
  scores: [], leakage: [], live: [],
};
const revisions: Revisions = {
  schema_version: 1, settled_months: 24,
  series: [{
    series: "gdp", label: "GDP", unit: "points", resolution: 0.1, latest_vintage: "2026-01-01", n: 2,
    mean_revision: null, mean_abs_revision: null, mean_abs_next: null, share_up: null, share_down: null,
    mean_abs_first: null, biggest: [],
    points: [{ period: "2020-04-01", first: -10, next: -9, latest: -8, settled: true }],
  }],
};

describe("pickReleaseCase", () => {
  it("picks the release farthest from the median forecast and ignores rows without an answer or enough forecasts", () => {
    const c = pickReleaseCase(arena, revisions, "gdp");
    expect(c?.period).toBe("2020-04-01");
    expect(c?.median).toBe(1.5);
    expect(c?.entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(c?.next).toBe(-9);
    expect(c?.latest).toBe(-8);
  });
  it("returns null when the target has no usable release", () => {
    expect(pickReleaseCase(arena, revisions, "cpi")).toBeNull();
  });
  it("converts revised payroll numbers from jobs to thousands of jobs", () => {
    const payrolls: Arena = { ...arena, forecasts: [
      { target: "payrolls", period: "2021-01-01", made_on: "2021-02-01", actual: 100, values: { a: 10, b: 20 }, intervals: {} },
    ] };
    const jobs: Revisions = { ...revisions, series: [{ ...revisions.series[0]!, series: "payrolls", points: [
      { period: "2021-01-01", first: 100000, next: null, latest: 120000, settled: true },
    ] }] };
    expect(pickReleaseCase(payrolls, jobs, "payrolls")?.latest).toBe(120);
  });
});

describe("wording", () => {
  it("formats values with their unit and a true minus sign", () => {
    expect(formatReleaseValue("gdp", -32.94)).toBe("−32.9% annualized");
    expect(formatReleaseValue("payrolls", 1234)).toBe("1,234 thousand jobs");
  });
  it("builds a sentence only from the numbers and states the direction of the gap", () => {
    const sentence = releaseSentence(pickReleaseCase(arena, revisions, "gdp")!);
    expect(sentence).toContain("centered on 1.5% annualized");
    expect(sentence).toContain("11.5 percentage points below that");
    expect(sentence).toContain("below that");
    expect(sentence).toContain("−8.0% annualized");
  });
});
