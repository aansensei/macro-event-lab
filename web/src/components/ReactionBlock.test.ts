import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReactionBlock } from "./ReactionBlock";

const reaction = { date: "2025-01-15", prev_date: "2025-01-14", dgs2_bp: 3, dgs10_bp: -2 };

it("labels daily changes without claiming the whole move was caused by the announcement", () => {
  const html = renderToStaticMarkup(createElement(ReactionBlock, { reaction, status: "published", isFomc: false }));
  expect(html).toContain("2-year yield rose 3 bp, 10-year fell 2 bp");
  expect(html).toContain("does not isolate");
  expect(html).not.toContain("before trading opened");
  expect(html).toContain("https://www.federalreserve.gov/releases/h15/");
});

it("retains a partial observation, handles unchanged yields, and explains the Fed horizon", () => {
  const html = renderToStaticMarkup(createElement(ReactionBlock, {
    reaction: { ...reaction, dgs2_bp: 0, dgs10_bp: null }, status: "published", isFomc: true,
  }));
  expect(html).toContain("2-year yield was unchanged");
  expect(html).toContain("10-year yield unavailable");
  expect(html).toContain("trading before the Fed announcement");
  expect(html).toContain('class="yield-label">2Y');
  expect(html).not.toContain('class="yield-label">10Y');
});

it("does not display a reaction for upcoming or unpublished events even if a payload exists", () => {
  for (const status of ["upcoming", "not_published"] as const) {
    const html = renderToStaticMarkup(createElement(ReactionBlock, { reaction, status, isFomc: false }));
    expect(html).not.toContain("yield-pair");
    if (status === "not_published") {
      expect(html).toContain("This dataset has no published result");
      expect(html).not.toContain("did not come out");
    }
  }
  const missing = renderToStaticMarkup(createElement(ReactionBlock, { reaction: null, status: "published", isFomc: false }));
  expect(missing).toContain("Daily yields unavailable");
});
