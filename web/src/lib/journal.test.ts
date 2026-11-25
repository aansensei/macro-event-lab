import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Journal } from "../pages/Journal";
import { JOURNAL } from "./journal";

describe("the build journal", () => {
  it("has entries with unique ids, a month, a title and at least one paragraph", () => {
    expect(JOURNAL.length).toBeGreaterThanOrEqual(5);
    expect(new Set(JOURNAL.map((entry) => entry.id)).size).toBe(JOURNAL.length);
    for (const entry of JOURNAL) {
      expect(entry.month).toMatch(/^[A-Z][a-z]+ \d{4}$/);
      expect(entry.title.length).toBeGreaterThan(10);
      expect(entry.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("uses no dash as punctuation and names no market data provider, tool or assistant", () => {
    const text = JOURNAL.flatMap((entry) => [entry.title, ...entry.paragraphs]).join(" ");
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/kalshi|\bKX[A-Z]+\b|\bAI\b|assistant|swarm|\bbot\b|agent|prompt/i);
  });

  it("renders every entry on the page with a back link to the author section", () => {
    const html = renderToStaticMarkup(createElement(Journal));
    for (const entry of JOURNAL) expect(html).toContain(`id="journal-${entry.id}"`);
    expect(html).toContain("?page=about#about-author");
  });
});
