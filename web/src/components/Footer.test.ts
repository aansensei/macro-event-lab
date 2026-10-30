import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { Footer } from "./Footer";

it("opens the existing construction page for the journal without exposing its Markdown file", () => {
  const html = renderToStaticMarkup(createElement(Footer, { dataThrough: null, onNavigate: vi.fn() }));
  const journal = html.match(/<a[^>]*>Build journal[\s\S]*?<\/a>/)?.[0];
  expect(journal).toContain('href="https://aansensei.dev/under-construction.html"');
  expect(journal).toContain('target="_blank"');
  expect(journal).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("JOURNEY.md");
});
