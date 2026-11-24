import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Method } from "./Method";

it("research build renders its own method page without the public closing block", () => {
  const html = renderToStaticMarkup(createElement(Method));
  expect(html).not.toContain("Where to go next");
});
