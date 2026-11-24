import { describe, expect, it } from "vitest";

import { STORY, nextStop, storyFor, storyHref, storyIndex } from "./story";

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

  it("gives the public edition its own path from revisions to arena to nowcast, ending at Method", () => {
    const pub = storyFor(true);
    expect(pub.map((step) => step.page)).toEqual(["revisions", "arena", "models"]);
    expect(nextStop("revisions", pub)?.href).toBe("?page=arena");
    expect(nextStop("arena", pub)?.href).toBe("?page=models");
    expect(nextStop("models", pub)?.href).toBe("?page=method");
    expect(storyIndex("events", pub)).toBe(-1);
  });

  it("keeps the research path unchanged", () => {
    expect(storyFor(false)).toBe(storyFor(false));
    expect(storyFor(false).map((step) => step.page)).toEqual(["events", "compare", "scorecard", "revisions"]);
  });
});
