import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { Footer } from "./Footer";
import { About } from "../pages/About";

it("opens the existing construction page for the journal without exposing its Markdown file", () => {
  const html = renderToStaticMarkup(createElement(Footer, { dataThrough: null, onNavigate: vi.fn() }));
  const journal = html.match(/<a[^>]*>Build journal[\s\S]*?<\/a>/)?.[0];
  expect(journal).toContain('href="https://aansensei.dev/under-construction.html"');
  expect(journal).toContain('target="_blank"');
  expect(journal).toContain('rel="noopener noreferrer"');
  expect(html).not.toContain("JOURNEY.md");
});

it("shows a short educational notice and links to an expanded disclaimer on About", () => {
  const footer = renderToStaticMarkup(createElement(Footer, { dataThrough: null, onNavigate: vi.fn() }));
  expect(footer).toContain("Educational research only.");
  expect(footer).toContain("may contain errors");
  expect(footer).toContain("Not investment advice.");
  expect(footer).toContain('href="?page=about#disclaimer"');
  expect(footer).toContain("See disclaimer");
  expect(footer).toContain("FRED® API");
  expect(footer).toContain("not endorsed");
  const about = renderToStaticMarkup(createElement(About));
  expect(about).toContain('id="disclaimer"');
  expect(about).toContain('aria-labelledby="disclaimer-title"');
  expect(about).toContain('id="disclaimer-title"');
  expect(about).not.toContain('<details class="disclaimer"');
});
