import { describe, expect, it } from "vitest";

import type { RevisionSeries } from "../data/types";
import { periodLabel, printValue, revisionFinding, revisionSize, signedSize } from "./revisionWords";

function series(over: Partial<RevisionSeries>): RevisionSeries {
  return {
    series: "KXPAYROLLS", label: "jobs", unit: "jobs", resolution: 1000, latest_vintage: "2026-10-02",
    n: 298, mean_revision: 742, mean_abs_revision: 73930, mean_abs_next: 33198, share_up: 0.513,
    share_down: 0.487, mean_abs_first: 297359, biggest: [], points: [],
    ...over,
  };
}

describe("revisionSize", () => {
  it("rounds jobs to the thousand and points to two decimals", () => {
    expect(revisionSize("jobs", -73930)).toBe("74,000 jobs");
    expect(revisionSize("% m/m", 0.082886)).toBe("0.08 points");
  });
});

describe("revisionFinding", () => {
  it("reads payroll revisions: sizeable, partly early, without direction", () => {
    const text = revisionFinding(series({}), "2000");
    expect(text).toContain("moved by 74,000 jobs on average");
    expect(text).toContain("about 25% of the size of a typical jobs number (297,000 jobs)");
    expect(text).toContain("The next report already moved it by 33,000 jobs");
    expect(text).toContain("no clear direction: 51% went up and 49% went down");
  });

  it("says when revisions come late and when they lean one way", () => {
    const text = revisionFinding(
      series({ label: "CPI", unit: "% m/m", mean_abs_revision: 0.08, mean_abs_next: 0.006, mean_revision: 0.04, mean_abs_first: 0.3 }),
      "2000",
    );
    expect(text).toContain("only 0.01 points; most of the revision arrived months or years later");
    expect(text).toContain("Revisions leaned up");
    expect(text).toContain("the average was +0.04 points");
  });

  it("explains an empty series instead of inventing numbers", () => {
    expect(revisionFinding(series({ n: 0, mean_abs_revision: null }), "2000")).toContain("not enough settled jobs numbers");
  });
});

describe("labels", () => {
  it("names months and quarters", () => {
    expect(periodLabel("KXPAYROLLS", "2020-03-01")).toBe("Mar 2020");
    expect(periodLabel("KXGDP", "2020-04-01")).toBe("Q2 2020");
  });
  it("prints values and signed revisions", () => {
    expect(printValue("jobs", -701000)).toBe("−701,000 jobs");
    expect(printValue("% m/m", 0.4)).toBe("0.4%");
    expect(signedSize("jobs", -697000)).toBe("−697,000 jobs");
    expect(signedSize("% annualized", 4.9)).toBe("+4.90 points");
  });
});
