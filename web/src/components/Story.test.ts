import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { STORY } from "../lib/story";
import { StoryNext, StoryPath } from "./Story";

it("keeps one current step and a useful continuation for every story page", () => {
  for (const step of STORY) {
    const path = renderToStaticMarkup(createElement(StoryPath, { current: step.page }));
    expect(path.match(/aria-current="step"/g)).toHaveLength(1);
    expect(path).not.toContain("?page=models");
    const next = renderToStaticMarkup(createElement(StoryNext, { current: step.page }));
    expect(next).toContain(step.lead);
    expect(next).toContain('aria-label="Next in the story"');
  }
  expect(renderToStaticMarkup(createElement(StoryNext, { current: "about" }))).toBe("");
});
