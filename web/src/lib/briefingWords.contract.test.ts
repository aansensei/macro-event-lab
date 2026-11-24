import { describe, expect, it } from "vitest";

import { daysUntil, formatReleaseDate, periodTitle } from "./briefingWords";

describe("formatReleaseDate", () => {
  it("formats an ISO calendar date in long English UTC form", () => {
    expect(formatReleaseDate("2026-12-04")).toBe("Friday, December 4, 2026");
  });

  it("handles a nonexistent calendar date as invalid input without rolling over", () => {
    let output: string | undefined;
    let threw = false;
    try {
      output = formatReleaseDate("2026-02-29");
    } catch {
      threw = true;
    }
    if (!threw) {
      expect(output).not.toContain("March");
      expect(output).not.toBe("Invalid Date");
    }
    expect(threw || output === "" || output === "2026-02-29").toBe(true);
  });
});

describe("daysUntil", () => {
  it("computes whole day differences including zero, past, month end and year end", () => {
    expect(daysUntil("2026-12-04", "2026-11-24")).toBe(10);
    expect(daysUntil("2026-11-24", "2026-11-24")).toBe(0);
    expect(daysUntil("2026-11-20", "2026-11-24")).toBe(-4);
    expect(daysUntil("2026-12-01", "2026-11-30")).toBe(1);
    expect(daysUntil("2027-01-02", "2026-12-30")).toBe(3);
  });
});

describe("periodTitle", () => {
  it("formats monthly and quarterly reference periods", () => {
    expect(periodTitle("gdp", "2026-10-01")).toBe("Q4 2026");
    expect(periodTitle("cpi", "2026-11-01")).toBe("November 2026");
    expect(periodTitle("gdp", "2026-01-01")).toBe("Q1 2026");
  });
});
