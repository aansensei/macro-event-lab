import { describe, expect, it } from "vitest";

import { easeOutCubic, lerpArrays } from "./tween";

describe("easeOutCubic", () => {
  it("starts at 0, ends at 1 and clamps outside", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
  });

  it("is past halfway at the midpoint", () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
  });
});

describe("lerpArrays", () => {
  it("interpolates element by element", () => {
    expect(lerpArrays([0, 10], [1, 20], 0.5)).toEqual([0.5, 15]);
  });

  it("jumps when the shapes differ", () => {
    expect(lerpArrays([0], [1, 2], 0.5)).toEqual([1, 2]);
  });
});
