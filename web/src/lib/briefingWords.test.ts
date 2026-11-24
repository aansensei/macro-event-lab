import { describe, expect, it } from "vitest";

import { daysUntil, formatReleaseDate, periodTitle } from "./briefingWords";

describe("briefingWords", () => {
  it("formats release dates in UTC long English", () => {
    expect(formatReleaseDate("2026-12-04")).toBe("Friday, December 4, 2026");
    expect(formatReleaseDate("2026-01-01")).toBe("Thursday, January 1, 2026");
  });

  it("rejects impossible calendar dates", () => {
    expect(() => formatReleaseDate("2026-02-29")).toThrow();
  });

  it("computes whole days until a release date", () => {
    expect(daysUntil("2026-12-04", "2026-11-24")).toBe(10);
    expect(daysUntil("2026-11-24", "2026-11-24")).toBe(0);
    expect(daysUntil("2026-11-20", "2026-11-24")).toBe(-4);
    expect(daysUntil("2027-01-05", "2026-12-28")).toBe(8);
  });

  it("formats monthly and quarterly period titles", () => {
    expect(periodTitle("cpi", "2026-11-01")).toBe("November 2026");
    expect(periodTitle("payrolls", "2026-12-01")).toBe("December 2026");
    expect(periodTitle("gdp", "2026-01-01")).toBe("Q1 2026");
    expect(periodTitle("gdp", "2026-10-01")).toBe("Q4 2026");
  });
});
