import { expect, it } from "vitest";

import { aboutCopyFor } from "./aboutCopy";

it("describes the live preliminary arena and keeps the foundation models marked as not yet run", () => {
  const copy = aboutCopyFor(true);
  expect(copy.lead).toContain("auditable, point-in-time forecast arena");
  expect(copy.lead).toContain("professional forecaster surveys");
  expect(JSON.stringify(copy)).not.toMatch(/kalshi|KX(CPI|GDP|PAYROLLS|FED)/i);
  expect(copy.lead).toContain("Preliminary results");
  expect(copy.stack[1]?.[1]).toContain("have not run");
  expect(copy.lead).not.toContain("only the two simplest");
  expect(JSON.stringify(copy)).not.toMatch(/\u2014|\u2013/);
});

it("preserves the research explanation and survey comparison", () => {
  const copy = aboutCopyFor(false);
  expect(copy.glance[1]?.[1]).toContain("odds Kalshi traders");
  expect(copy.faq[1]?.[0]).toBe("Why prediction markets instead of economist surveys?");
  expect(copy.disclaimer[2]).toContain("Kalshi");
});
