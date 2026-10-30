import { expect, it } from "vitest";
import type { Revisions, Summary, SummaryPoint } from "../data/types";
import { overviewFindings, releaseExamples, revisionHook } from "./overview";
import { PRIMARY, LEARN } from "./navigation";
import { parseUrlState } from "./url";
import { STORY, storyHref } from "./story";

it("derives findings from coverage, skill and absolute revisions without hardcoded results", () => {
  const summary = { series: [{ series: "KXCPI", hit_90: 0.82, n: 50,
    scores: { skill: -0.12, n: 48 } }] } as Summary;
  const revisions = { settled_months: 24, series: [{ series: "KXPAYROLLS", n: 120,
    mean_abs_revision: 45678.9 }] } as Revisions;
  const findings = overviewFindings(summary, revisions);
  expect(findings.map((f) => f.value)).toEqual(["82%", "-12%", "45,679 jobs"]);
  expect(findings[0]!.detail).toContain("50 CPI");
  expect(findings[1]!.detail).toContain("48 CPI");
  expect(findings[2]!.detail).toContain("120 jobs");
});

it("does not invent results when source series are missing", () => {
  expect(overviewFindings({ series: [], points: [], schema_version: 1 },
    { series: [], settled_months: 24, schema_version: 1 }).map((f) => f.value))
    .toEqual(["Not available", "Not available", "Not available"]);
});

it("keeps About and Overview outside Learn, with every page reachable once", () => {
  expect(PRIMARY.map(([p]) => p)).toEqual(["overview", "events", "compare", "scorecard", "revisions", "about"]);
  expect(LEARN.map(([p]) => p)).toEqual(["models", "method", "glossary"]);
  expect(new Set([...PRIMARY, ...LEARN].map(([p]) => p)).size).toBe(9);
  expect(STORY.map((s) => parseUrlState(storyHref(s.page)).page)).toEqual(
    ["events", "compare", "scorecard", "revisions"],
  );
});

it("selects the largest upward settled jobs revision without modifying the input", () => {
  const revisions = { series: [{ series: "KXPAYROLLS", latest_vintage: "2026-10-02", points: [
    { period: "2025-01-01", first: 100, latest: 500, settled: true },
    { period: "2025-02-01", first: 100, latest: 1000, settled: false },
    { period: "2025-03-01", first: 500, latest: 0, settled: true },
    { period: "2025-04-01", first: 100, latest: null, settled: true },
  ] }] } as Revisions;
  const before = JSON.stringify(revisions);
  expect(revisionHook(revisions)).toEqual({ period: "2025-01-01", first: 100,
    latest: 500, vintage: "2026-10-02" });
  expect(JSON.stringify(revisions)).toBe(before);
  expect(revisionHook({ series: [] } as unknown as Revisions)).toBeNull();
});

it("selects the largest absolute surprise with a 2-year yield observation for each supported series", () => {
  const point: SummaryPoint = { id: "cpi-small", series: "KXCPI", title: "Fixture", surprise_sd: 1,
    dgs2_bp: 0, dgs10_bp: null, in_50: false, in_90: true };
  const summary: Summary = { schema_version: 1, series: [], points: [
    point, { ...point, id: "cpi-extreme", surprise_sd: -3 },
    { ...point, id: "cpi-no-yield", surprise_sd: 9, dgs2_bp: null },
    { ...point, id: "jobs-sample", series: "KXPAYROLLS" },
    { ...point, id: "fed-sample", series: "KXFED" },
    { ...point, id: "gdp-sample", series: "KXGDP" },
    { ...point, id: "other-series", series: "UNKNOWN" },
  ] };
  const before = JSON.stringify(summary);
  const selected = releaseExamples(summary);
  expect(selected.map(({ label }) => label)).toEqual(["CPI", "Jobs", "GDP", "Fed"]);
  expect(selected[0]!.point.id).toBe("cpi-extreme");
  expect(selected[0]!.point.dgs10_bp).toBeNull();
  expect(JSON.stringify(summary)).toBe(before);
});

it("resolves equal surprises by identifier and handles empty or unobserved series", () => {
  const point: SummaryPoint = { id: "b", series: "KXCPI", title: "Fixture", surprise_sd: 0,
    dgs2_bp: 0, dgs10_bp: null, in_50: true, in_90: true };
  const summary: Summary = { schema_version: 1, series: [], points: [point, { ...point, id: "a" }] };
  expect(releaseExamples(summary)[0]!.point.id).toBe("a");
  expect(releaseExamples({ ...summary, points: [] })).toEqual([]);
  expect(releaseExamples({ ...summary, points: [{ ...point, dgs2_bp: null }] })).toEqual([]);
});
