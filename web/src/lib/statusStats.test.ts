import { expect, it } from "vitest";

import { statusFixture } from "../data/statusFixture";
import { checkCounts, checkTitle, sourceAgeDays, visibleChecks } from "./statusStats";

it("uses the information cutoff for calendar-day ages, including future anomalies", () => {
  const source = statusFixture.sources[0]!;
  expect(sourceAgeDays(source, "2026-11-20")).toBe(5);
  expect(sourceAgeDays(source, "2026-11-14")).toBe(-1);
  expect(sourceAgeDays(statusFixture.sources[1]!, "2026-11-20")).toBe(97);
});

it("counts and filters the executed check outcomes", () => {
  expect(checkCounts(statusFixture.checks)).toEqual({ all: 4, pass: 2, warn: 1, fail: 1 });
  expect(checkCounts([])).toEqual({ all: 0, pass: 0, warn: 0, fail: 0 });
  expect(visibleChecks(statusFixture.checks, "all")).toHaveLength(4);
  expect(visibleChecks(statusFixture.checks, "warn").map((check) => check.name)).toEqual(["missing_observations"]);
  expect(visibleChecks([], "fail")).toEqual([]);
});

it("gives check identifiers readable titles", () => {
  expect(checkTitle("spf_forecasts")).toBe("Survey records and publication dates");
  expect(checkTitle("fixture_check")).toBe("fixture check");
});
