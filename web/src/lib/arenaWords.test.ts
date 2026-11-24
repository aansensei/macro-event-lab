import { expect, it } from "vitest";

import { arenaFixture } from "../data/arenaFixture";
import { ARENA_GUIDE, arenaValue, contestantKind, forecastReadout } from "./arenaWords";

it("formats supplied numbers without replacing missing values with zero", () => {
  expect(arenaValue(0)).toBe("0.00");
  expect(arenaValue(null)).toBe("Not available");
  expect(arenaValue(undefined)).toBe("Not available");
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
