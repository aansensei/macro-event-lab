import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Journal } from "../pages/Journal";
import { JOURNAL, TROUBLES } from "./journal";

describe("the build journal", () => {
  it("has entries with unique ids, a month, a title and at least one paragraph", () => {
    expect(JOURNAL.length).toBeGreaterThanOrEqual(5);
    expect(new Set(JOURNAL.map((entry) => entry.id)).size).toBe(JOURNAL.length);
    for (const entry of JOURNAL) {
      expect(entry.month).toMatch(/^([A-Z][a-z]+ \d{4}|The beginning)$/);
      expect(entry.title.length).toBeGreaterThan(10);
      expect(entry.rail.length).toBeGreaterThan(2);
      expect(entry.rail.length).toBeLessThanOrEqual(20);
      expect(entry.paragraphs.length).toBeGreaterThan(0);
    }
  });

  it("uses no dash as punctuation and names no market data provider, tool or assistant", () => {
    const text = [
      ...JOURNAL.flatMap((entry) => [entry.title, ...entry.paragraphs]),
      ...TROUBLES.flatMap((item) => [item.title, item.broke, item.cost, item.fix]),
    ].join(" ");
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(text).not.toMatch(/kalshi|\bKX[A-Z]+\b|\bAI\b|assistant|swarm|\bbot\b|agent|prompt/i);
  });

  it("renders every entry on the page with a back link to the author section", () => {
    const html = renderToStaticMarkup(createElement(Journal));
    for (const entry of JOURNAL) expect(html).toContain(`id="journal-${entry.id}"`);
    expect(html).toContain("?page=about#about-author");
  });

  it("lists troubles with unique ids and a filled in what broke, what it cost and how it was fixed", () => {
    expect(TROUBLES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(TROUBLES.map((item) => item.id)).size).toBe(TROUBLES.length);
    for (const item of TROUBLES) for (const text of [item.title, item.broke, item.cost, item.fix]) expect(text.length).toBeGreaterThan(20);
  });

  it("renders every trouble with its three parts", () => {
    const html = renderToStaticMarkup(createElement(Journal));
    for (const item of TROUBLES) expect(html).toContain(`id="trouble-${item.id}"`);
    expect(html.match(/What broke/g)).toHaveLength(TROUBLES.length);
    expect(html.match(/How it was fixed/g)).toHaveLength(TROUBLES.length);
  });
});
