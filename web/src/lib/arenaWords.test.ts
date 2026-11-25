import { expect, it } from "vitest";

import { arenaFixture } from "../data/arenaFixture";
import { ARENA_GUIDE, arenaCount, arenaPValue, arenaValue, contestantKind, coverageIntervalNote, coveragePercent, forecastReadout } from "./arenaWords";

it("formats supplied numbers without replacing missing values with zero", () => {
  expect(arenaValue(0)).toBe("0.00");
  expect(arenaValue(null)).toBe("Not available");
  expect(arenaValue(undefined)).toBe("Not available");
  expect(arenaCount(40)).toBe("40");
  expect(arenaCount(null)).toBe("Not available");
  expect(arenaPValue(0.042)).toBe("0.0420");
  expect(arenaPValue(null)).toBe("Not available");
  expect(arenaPValue(0)).toBe("less than 0.0001");
  expect(coveragePercent(0.875)).toBe("87.5%");
  expect(coveragePercent(null)).toBe("Not available");
  expect(coverageIntervalNote(0.78, 0.94, 40)).toBe("95% interval 78% to 94%, 40 forecasts");
  expect(coverageIntervalNote(0.2, 1, 1)).toBe("95% interval 20% to 100%, 1 forecast");
  expect(coverageIntervalNote(null, 0.94, 40)).toBeNull();
  expect(contestantKind("human")).toBe("Human");
  expect(ARENA_GUIDE).toContain("average squared forecast error");
  expect(ARENA_GUIDE).not.toMatch(/beats|proves|winner/i);
});

it("reads the actual, origin and interval independently of ranking claims", () => {
  const readout = forecastReadout(arenaFixture.forecasts[0]!, arenaFixture.targets[0]!, arenaFixture.contestants[0]);
  expect(readout).toContain("Q1 2025");
  expect(readout).toContain("Cutoff 2025-02-15");
  expect(readout).toContain("First print 0.00");
  expect(readout).toContain("90 percent interval 0.00 to 2.00");
  expect(forecastReadout(arenaFixture.forecasts[0]!, arenaFixture.targets[0]!, arenaFixture.contestants[1])).toContain("90 percent interval not available");
});
