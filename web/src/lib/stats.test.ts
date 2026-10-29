import { describe, expect, it } from "vitest";

import { ols } from "./stats";

describe("ols", () => {
  it("recovers an exact line", () => {
    const fit = ols([[0, 1], [1, 3], [2, 5]]);
    expect(fit?.slope).toBeCloseTo(2);
    expect(fit?.intercept).toBeCloseTo(1);
    expect(fit?.r).toBeCloseTo(1);
    expect(fit?.n).toBe(3);
  });

  it("gives a negative correlation for a falling cloud", () => {
    expect(ols([[0, 2], [1, 1], [2, 1], [3, -1]])?.r).toBeLessThan(-0.9);
  });

  it("has no line for one point or a vertical stack", () => {
    expect(ols([[1, 2]])).toBeNull();
    expect(ols([[1, 2], [1, 5]])).toBeNull();
  });
});
