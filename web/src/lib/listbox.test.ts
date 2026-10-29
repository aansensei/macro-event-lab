import { describe, expect, it } from "vitest";

import { moveIndex, typeaheadIndex } from "./listbox";

describe("moveIndex", () => {
  it("steps and stops at the ends", () => {
    expect(moveIndex("ArrowDown", 0, 3)).toBe(1);
    expect(moveIndex("ArrowDown", 2, 3)).toBe(2);
    expect(moveIndex("ArrowUp", 0, 3)).toBe(0);
  });

  it("jumps to the ends and by pages", () => {
    expect(moveIndex("Home", 5, 20)).toBe(0);
    expect(moveIndex("End", 5, 20)).toBe(19);
    expect(moveIndex("PageDown", 15, 20)).toBe(19);
    expect(moveIndex("PageUp", 5, 20)).toBe(0);
  });

  it("ignores other keys and empty lists", () => {
    expect(moveIndex("a", 1, 3)).toBeNull();
    expect(moveIndex("ArrowDown", 0, 0)).toBeNull();
  });
});

describe("typeaheadIndex", () => {
  const labels = ["All types", "CPI", "Jobs", "FOMC", "GDP", "CPI, August"];

  it("finds the next label starting with the typed text", () => {
    expect(typeaheadIndex(labels, "j", 0)).toBe(2);
    expect(typeaheadIndex(labels, "cpi", 1)).toBe(5);
  });

  it("wraps around and ignores case", () => {
    expect(typeaheadIndex(labels, "A", 4)).toBe(0);
  });

  it("returns -1 when nothing matches", () => {
    expect(typeaheadIndex(labels, "z", 0)).toBe(-1);
    expect(typeaheadIndex(labels, "", 0)).toBe(-1);
  });
});
