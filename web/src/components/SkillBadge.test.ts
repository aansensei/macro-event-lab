import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SkillBadge } from "./SkillBadge";

it("distinguishes lower error, higher error, equal error and an unavailable benchmark", () => {
  expect(renderToStaticMarkup(createElement(SkillBadge, { skill: 1 - 3 / 4 }))).toContain("Beats the naive guess by 25%");
  const worse = renderToStaticMarkup(createElement(SkillBadge, { skill: 1 - 5 / 4 }));
  expect(worse).toContain("25% more error than naive");
  expect(worse).not.toContain("does as well");
  expect(renderToStaticMarkup(createElement(SkillBadge, { skill: 0 }))).toContain("Matches the naive guess");
  expect(renderToStaticMarkup(createElement(SkillBadge, { skill: null }))).toContain("No benchmark");
});
