import { describe, expect, it } from "vitest";

import { MARKET_PAGES, inEdition } from "./edition";
import { navigationFor } from "./navigation";

describe("edition", () => {
  it("keeps every page in the research build", () => {
    expect(MARKET_PAGES.every((page) => inEdition(page, false))).toBe(true);
  });

  it("leaves the market pages out of the public edition", () => {
    expect(MARKET_PAGES.some((page) => inEdition(page, true))).toBe(false);
    expect(inEdition("revisions", true)).toBe(true);
    expect(inEdition("models", true)).toBe(true);
  });

  it("never links a market page from the public navigation", () => {
    const { primary, learn } = navigationFor(true);
    const linked = [...primary, ...learn].map(([page]) => page);
    expect(linked.filter((page) => MARKET_PAGES.includes(page))).toEqual([]);
    expect(linked).toContain("models");
  });

  it("keeps the full navigation for the research build", () => {
    const { primary } = navigationFor(false);
    expect(primary.map(([page]) => page)).toContain("events");
  });
});
