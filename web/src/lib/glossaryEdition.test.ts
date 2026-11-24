import { expect, it } from "vitest";

import { glossaryGroupsFor, glossaryEntryFor } from "./glossaryEdition";
import { GLOSSARY_GROUPS, glossaryEntry } from "./glossary";

it("preserves research groups and definitions", () => {
  expect(glossaryGroupsFor(false)).toBe(GLOSSARY_GROUPS);
  expect(glossaryEntryFor("first-print", false)).toBe(glossaryEntry("first-print"));
});

it("keeps public definitions about economic data and publication time", () => {
  const groups = glossaryGroupsFor(true);
  expect(groups.every((group) => group.ids.length > 0)).toBe(true);
  expect(groups.flatMap((group) => group.ids)).toContain("first-print");
  expect(glossaryEntryFor("point-in-time", true)?.long).toContain("cutoff");
  expect(glossaryEntryFor("prediction-market", true)).toBeUndefined();
  expect(glossaryEntryFor("missing", true)).toBeUndefined();
});
