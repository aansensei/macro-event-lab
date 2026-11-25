import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { NotesInvite } from "./NotesInvite";

it("is one link to the notes page with a title and a sentence", () => {
  const html = renderToStaticMarkup(createElement(NotesInvite));
  expect(html).toContain('href="?page=notes"');
  expect(html).toContain("Read the reasoning behind a forecast");
  expect(html).toContain("never edited afterwards");
  expect(html.match(/<a /g)).toHaveLength(1);
});
