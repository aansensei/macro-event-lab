import { describe, expect, it } from "vitest";

import {
  MINUS,
  binLabel,
  fixed,
  formatDelta,
  formatEt,
  formatEtDate,
  formatIsoDate,
  formatNumber,
  formatValue,
  hourLabel,
  seriesKind,
  signed,
  unitParts,
} from "./format";

describe("signs", () => {
  it("uses the true minus sign and drops it when the value rounds to zero", () => {
    expect(fixed(-0.4, 1)).toBe(`${MINUS}0.4`);
    expect(fixed(-0.001, 1)).toBe("0.0");
    expect(signed(1.04, 1, " SD")).toBe("+1.0 SD");
    expect(signed(-0.93, 1, " SD")).toBe(`${MINUS}0.9 SD`);
    expect(signed(0.02, 1)).toBe("0.0");
  });
});

describe("values by unit", () => {
  it("prints payrolls in thousands and percents with the series' decimals", () => {
    expect(formatValue(29000, "jobs")).toBe("29k");
    expect(formatValue(-23000, "jobs")).toBe(`${MINUS}23k`);
    expect(formatValue(0, "jobs")).toBe("0");
    expect(formatValue(-400, "jobs")).toBe("0");
    expect(formatValue(0.6, "% m/m")).toBe("0.6%");
    expect(formatValue(0.583, "% m/m", true)).toBe("0.58%");
    expect(formatValue(4, "% upper bound")).toBe("4.00%");
    expect(formatNumber(1.5, "% annualized")).toBe("1.5");
  });

  it("splits the unit into a large lead and a small caption", () => {
    expect(unitParts("% m/m")).toEqual({ lead: "%", rest: "m/m" });
    expect(unitParts("jobs")).toEqual({ lead: "", rest: "jobs" });
    expect(unitParts(null)).toEqual({ lead: "", rest: "" });
  });

  it("formats surprises in points or thousands of jobs", () => {
    expect(formatDelta(0.0295, "% m/m")).toBe("+0.03 pp");
    expect(formatDelta(-48597.7, "jobs")).toBe(`${MINUS}48.6k jobs`);
  });
});

describe("binLabel", () => {
  it("names a one-step bin by its printed value", () => {
    expect(binLabel([0.5, 0.6, 0.56], "% m/m", 0.1)).toBe("0.6%");
    expect(binLabel([3.75, 4, 0.8], "% upper bound", 0.25)).toBe("4.00%");
  });

  it("names wider bins by the first and last printable value", () => {
    expect(binLabel([20000, 30000, 0.06], "jobs", 1000)).toBe("21k to 30k");
  });

  it("names the open tails", () => {
    expect(binLabel([null, -0.4, 0.005], "% m/m", 0.1)).toBe(`≤ ${MINUS}0.4%`);
    expect(binLabel([125000, null, 0.27], "jobs", 1000)).toBe("> 125k");
    expect(binLabel([null, null, 1], "% m/m", 0.1)).toBe("Any outcome");
  });

  it("falls back to both edges without a resolution", () => {
    expect(binLabel([0.5, 0.6, 0.5], "% m/m", null)).toBe("0.5% to 0.6%");
  });
});

describe("time", () => {
  it("labels hours before the close", () => {
    expect(hourLabel(48)).toBe(`T${MINUS}48h`);
    expect(hourLabel(0)).toBe("Close");
  });

  it("shows New York time across daylight saving changes", () => {
    expect(formatEt("2026-10-14T11:00:00Z")).toBe("Oct 14 07:00 ET");
    expect(formatEt("2026-12-10T19:00:00Z")).toBe("Dec 10 14:00 ET");
    expect(formatEtDate("2026-10-28T17:55:00Z")).toBe("Oct 28 2026");
  });

  it("reads plain dates without shifting the day", () => {
    expect(formatIsoDate("2026-10-14")).toBe("Oct 14 2026");
  });

  it("maps Kalshi series to release kinds", () => {
    expect(seriesKind("KXPAYROLLS")).toBe("jobs");
    expect(seriesKind("KXNEW")).toBe("other");
  });
});
