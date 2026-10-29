import { describe, expect, it } from "vitest";

import { activeSection } from "./rail";

describe("activeSection", () => {
  it("starts on the first section before any has reached the read line", () => {
    expect(activeSection([120, 900, 1600], 800, false)).toBe(0);
  });

  it("follows the last section whose top passed the read line", () => {
    expect(activeSection([-900, -100, 250, 1200], 800, false)).toBe(2);
    expect(activeSection([-900, -100, 300, 1200], 800, false)).toBe(1);
  });

  it("picks the last section at the bottom of the page", () => {
    expect(activeSection([-1400, -600, 500], 800, true)).toBe(2);
  });

  it("returns -1 when there are no sections", () => {
    expect(activeSection([], 800, false)).toBe(-1);
  });
});
