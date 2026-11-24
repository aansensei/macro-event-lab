import { describe, expect, it } from "vitest";

import { liveSentence } from "./nowcastWords";

describe("liveSentence", () => {
  it("names the quarter, the forecast and the data cutoff", () => {
    expect(liveSentence({ reference_period: "2026-07-01", as_of: "2026-11-23", nowcast: 3.42, months_published: 3, missing: [] }))
      .toBe("Q3 2026: 3.4% annualized growth, from data published by Nov 23 2026 (3 of 3 months of payrolls)");
  });

  it("writes a contraction with a minus sign", () => {
    expect(liveSentence({ reference_period: "2026-01-01", as_of: "2026-03-02", nowcast: -0.84, months_published: 1, missing: ["PCEC96"] }))
      .toContain("Q1 2026: \u22120.8% annualized growth");
  });
});
