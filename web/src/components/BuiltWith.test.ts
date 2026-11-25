import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { BuiltWith } from "./BuiltWith";

const html = renderToStaticMarkup(createElement(BuiltWith));
const text = html.replace(/<[^>]+>/g, " ");

it("shows the four cards with their titles", () => {
  for (const title of ["Data", "Website", "Checks", "Deploy"]) expect(html).toContain(`<h3 class="built-card-title">${title}</h3>`);
});

it("gives every tool a name and a role", () => {
  for (const [tool, role] of [["Python", "pipeline"], ["Polars", "tables"], ["React 19", "pages"], ["Charts", "plain SVG"], ["Chart library", "none"], ["pytest", "pipeline tests"], ["GitHub Pages", "hosting"]]) {
    expect(html).toContain(`<span class="built-tool">${tool}</span><span class="built-role mono">${role}</span>`);
  }
  expect(html.match(/class="built-tool"/g)?.length).toBe(html.match(/class="built-role mono"/g)?.length);
});

it("says that charts are plain SVG, which the dependencies of the website confirm", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  expect(Object.keys(pkg.dependencies)).toEqual(["react", "react-dom"]);
});

it("uses no dash as punctuation and no outside link", () => {
  expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`));
  expect(html).not.toContain("<a ");
});
