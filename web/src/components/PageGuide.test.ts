import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PageGuide } from "./PageGuide";

it("renders the purpose, the first thing to look at and the limit as three labelled answers", () => {
  const html = renderToStaticMarkup(createElement(PageGuide, { purpose: "P text", lookAt: "L text", limit: "C text" }));
  expect(html).toContain("What this page is for");
  expect(html).toContain("Look at first");
  expect(html).toContain("What it cannot show");
  expect(html.indexOf("P text")).toBeLessThan(html.indexOf("L text"));
  expect(html.indexOf("L text")).toBeLessThan(html.indexOf("C text"));
});
