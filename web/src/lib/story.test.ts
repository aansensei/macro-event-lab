import { describe, expect, it } from "vitest";

import { STORY, nextStop, storyHref, storyIndex } from "./story";

describe("story", () => {
  it("runs from one release to the yardstick", () => {
    expect(STORY.map((s) => s.page)).toEqual(["events", "compare", "scorecard", "revisions"]);
  });

  it("links each step to the next and the last one to Method", () => {
    expect(nextStop("events")).toEqual({ href: "?page=compare", label: "Compare", question: "Does surprise matter?" });
    expect(nextStop("revisions")?.href).toBe("?page=method");
  });

  it("knows which pages are not part of the story", () => {
    expect(storyIndex("glossary")).toBe(-1);
    expect(nextStop("about")).toBeNull();
  });

  it("links Events explicitly so Overview stays the home", () => {
    expect(storyHref("events")).toBe("?page=events");
    expect(storyHref("scorecard")).toBe("?page=scorecard");
  });
});
