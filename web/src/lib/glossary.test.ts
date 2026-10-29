import { describe, expect, it } from "vitest";

import { GLOSSARY, GLOSSARY_GROUPS, glossaryEntry } from "./glossary";

describe("glossary", () => {
  it("has unique ids that are safe in a URL hash", () => {
    const ids = GLOSSARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("gives every term a short hint and a longer explanation", () => {
    for (const e of GLOSSARY) {
      expect(e.short.length).toBeGreaterThan(10);
      expect(e.long.length).toBeGreaterThan(e.short.length);
    }
  });

  it("looks entries up by id", () => {
    expect(glossaryEntry("sd")?.term).toBe("SD (standard deviation)");
    expect(glossaryEntry("missing")).toBeUndefined();
  });

  it("puts every entry in exactly one group", () => {
    const grouped = GLOSSARY_GROUPS.flatMap((g) => g.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(GLOSSARY.map((e) => e.id).sort());
  });
});
