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

it("draws a basket for an inflation note, bars for a jobs note and a desk for the index and other notes", () => {
  const cpi = renderToStaticMarkup(createElement(NoteArt, { target: "cpi" }));
  expect(cpi).toContain("art-basket");
  expect(cpi).not.toContain("art-bar");
  expect(cpi).not.toMatch(/(fill|stroke)="#/);
  const payrolls = renderToStaticMarkup(createElement(NoteArt, { target: "payrolls" }));
  expect(payrolls).toContain("art-bar");
  expect(payrolls).not.toContain("art-sheet");
  for (const target of ["gdp", undefined]) {
    const html = renderToStaticMarkup(createElement(NoteArt, { target }));
    expect(html).toContain("art-sheet");
    expect(html).not.toContain("art-bar");
    expect(html).not.toContain("art-tag");
    expect(html).not.toMatch(/(fill|stroke)="#/);
  }
});
