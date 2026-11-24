import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { HowToRead } from "./HowToRead";

it("renders a collapsed details element named for the subject with the explanation inside", () => {
  const html = renderToStaticMarkup(createElement(HowToRead, null, createElement("p", null, "Dots are forecasts.")));
  expect(html).toContain("<details");
  expect(html).not.toContain(" open");
  expect(html).toContain("How to read this chart");
  expect(html).toContain("Dots are forecasts.");
});

it("can describe a table instead of a chart", () => {
  const html = renderToStaticMarkup(createElement(HowToRead, { subject: "table", children: createElement("p", null, "x") }));
  expect(html).toContain("How to read this table");
});
