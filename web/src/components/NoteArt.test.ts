import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { NoteArt } from "./NoteArt";

it("draws a decorative illustration that assistive technology skips, with its caption", () => {
  const html = renderToStaticMarkup(createElement(NoteArt, { caption: "A caption." }));
  expect(html).toContain("<figure");
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain('viewBox="0 0 800 290"');
  expect(html).toContain("<figcaption");
  expect(html).toContain("A caption.");
});

it("leaves out the caption element when there is no caption", () => {
  expect(renderToStaticMarkup(createElement(NoteArt, {}))).not.toContain("figcaption");
});

it("takes every colour from the site tokens, never a fixed colour", () => {
  const html = renderToStaticMarkup(createElement(NoteArt, {}));
  expect(html).not.toMatch(/(fill|stroke)="#/);
  expect(html).not.toMatch(/(fill|stroke)="(?!none)[a-z]+"/);
});

it("draws a shopping basket for an inflation note and bars for the others", () => {
  const cpi = renderToStaticMarkup(createElement(NoteArt, { target: "cpi" }));
  expect(cpi).toContain("art-basket");
  expect(cpi).not.toContain("art-bar");
  expect(cpi).not.toMatch(/(fill|stroke)="#/);
  for (const target of ["payrolls", "gdp", undefined]) {
    const html = renderToStaticMarkup(createElement(NoteArt, { target }));
    expect(html).toContain("art-bar");
    expect(html).not.toContain("art-basket");
  }
});
