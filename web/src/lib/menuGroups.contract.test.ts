import { describe, expect, it } from "vitest";

import { menuGroups } from "./menuGroups";
import { navigationFor } from "./navigation";
import type { Page } from "./url";

describe("menuGroups", () => {
  it("builds Main and More groups in the given order", () => {
    const primary: [Page, string][] = [
      ["overview", "Home"],
      ["revisions", "Revisions"],
      ["arena", "Arena"],
    ];
    const learn: [Page, string][] = [
      ["method", "Method"],
      ["data", "Open data"],
    ];

    expect(menuGroups(primary, learn)).toEqual([
      {
        title: "Main",
        items: [
          { page: "overview", label: "Home" },
          { page: "revisions", label: "Revisions" },
          { page: "arena", label: "Arena" },
        ],
      },
      {
        title: "More",
        items: [
          { page: "method", label: "Method" },
          { page: "data", label: "Open data" },
        ],
      },
    ]);
  });

  it("omits a group that has no items", () => {
    const primary: [Page, string][] = [["overview", "Home"]];
    const learn: [Page, string][] = [["glossary", "Glossary"]];

    expect(menuGroups(primary, [])).toEqual([
      { title: "Main", items: [{ page: "overview", label: "Home" }] },
    ]);
    expect(menuGroups([], learn)).toEqual([
      { title: "More", items: [{ page: "glossary", label: "Glossary" }] },
    ]);
    expect(menuGroups([], [])).toEqual([]);
  });

  it("maps the public primary and learn lists without mutating inputs", () => {
    const { primary, learn } = navigationFor(true);
    const primaryCopy = primary.map((entry) => [...entry] as [Page, string]);
    const learnCopy = learn.map((entry) => [...entry] as [Page, string]);

    const groups = menuGroups(primaryCopy, learnCopy);

    expect(groups.map((g: { title: string }) => g.title)).toEqual(["Main", "More"]);
    expect(groups[0]?.items).toEqual(primary.map(([page, label]) => ({ page, label })));
    expect(groups[1]?.items).toEqual(learn.map(([page, label]) => ({ page, label })));
    expect(primaryCopy).toEqual(primary);
    expect(learnCopy).toEqual(learn);
  });
});
