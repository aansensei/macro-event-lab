import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { Icon, type IconName } from "./Icon";

const NAMES: IconName[] = ["sun", "moon", "monitor", "chevron-down", "arrow-up", "arrow-right", "arrow-up-right",
  "check", "circle-check", "circle-alert", "circle-x", "list", "x", "menu", "globe", "linkedin", "github", "mail", "code"];

it("draws every named icon as a decorative 24 unit line icon that follows the text color", () => {
  for (const name of NAMES) {
    const html = renderToStaticMarkup(createElement(Icon, { name }));
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/<(path|circle|rect)/);
  }
});

it("takes a size and a class", () => {
  const html = renderToStaticMarkup(createElement(Icon, { name: "check", size: 12, className: "x" }));
  expect(html).toContain('width="12"');
  expect(html).toContain('class="x"');
});
