import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { PlayInvite } from "./PlayInvite";

it("is one link to the play page with a title and a sentence that says what the visitor does", () => {
  const html = renderToStaticMarkup(createElement(PlayInvite));
  expect(html).toContain('href="?page=play"');
  expect(html).toContain("Can you beat the forecasters?");
  expect(html).toContain("compare your miss with every contestant");
  expect(html.match(/<a /g)).toHaveLength(1);
});
