import { expect, it } from "vitest";

import { navigationFor } from "./navigation";

it.each([true, false])("places Data status in Learn for public=%s", (isPublic) => {
  const navigation = navigationFor(isPublic);
  expect(navigation.learn).toContainEqual(["status", "Data status"]);
  expect(navigation.primary.some(([page]) => page === "status")).toBe(false);
});

it("places Arena in public primary navigation and research Learn", () => {
  expect(navigationFor(true).primary).toContainEqual(["arena", "Arena"]);
  expect(navigationFor(false).learn).toContainEqual(["arena", "Arena"]);
  for (const edition of [true, false]) {
    const { primary, learn } = navigationFor(edition);
    const pages = [...primary, ...learn].map(([page]) => page);
    expect(new Set(pages).size).toBe(pages.length);
  }
});

it("opens with Home and lists the public story pages in reading order, then About", () => {
  expect(navigationFor(true).primary.map(([page]) => page)).toEqual(["overview", "revisions", "arena", "play", "models", "about"]);
  expect(navigationFor(true).learn.map(([page]) => page)).toEqual(["method", "status", "data", "briefing", "reactions", "notes", "glossary"]);
  for (const edition of [true, false]) expect(navigationFor(edition).primary[0]).toEqual(["overview", edition ? "Home" : "Overview"]);
});
