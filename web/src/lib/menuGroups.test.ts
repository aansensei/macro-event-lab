import { describe, expect, it } from "vitest";

import { menuGroups } from "./menuGroups";

describe("menuGroups", () => {
  it("groups primary and learn items under Main and More in order", () => {
    const groups = menuGroups(
      [["overview", "Home"], ["revisions", "Revisions"]],
      [["method", "Method"], ["glossary", "Glossary"]],
    );
    expect(groups).toEqual([
      {
        title: "Main",
        items: [
          { page: "overview", label: "Home" },
          { page: "revisions", label: "Revisions" },
        ],
      },
      {
        title: "More",
        items: [
          { page: "method", label: "Method" },
          { page: "glossary", label: "Glossary" },
        ],
      },
    ]);
  });

  it("omits any group that has no items", () => {
    expect(menuGroups([["overview", "Home"]], [])).toEqual([
      { title: "Main", items: [{ page: "overview", label: "Home" }] },
    ]);
    expect(menuGroups([], [["data", "Open data"]])).toEqual([
      { title: "More", items: [{ page: "data", label: "Open data" }] },
    ]);
    expect(menuGroups([], [])).toEqual([]);
  });
});
