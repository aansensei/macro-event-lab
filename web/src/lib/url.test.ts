import { describe, expect, it } from "vitest";

import { pageSearch, parseUrlState, urlSearch } from "./url";

describe("url state", () => {
  it("round trips an event and hour on the events page", () => {
    expect(parseUrlState(urlSearch("kxcpi-26sep", 48))).toEqual({ page: "events", event: "kxcpi-26sep", h: 48 });
  });

  it("reads the method and about pages", () => {
    expect(parseUrlState(pageSearch("about")).page).toBe("about");
    expect(parseUrlState(pageSearch("method")).page).toBe("method");
    expect(parseUrlState(pageSearch("glossary")).page).toBe("glossary");
    expect(parseUrlState(pageSearch("compare")).page).toBe("compare");
    expect(parseUrlState(pageSearch("scorecard")).page).toBe("scorecard");
    expect(parseUrlState(pageSearch("revisions")).page).toBe("revisions");
    expect(parseUrlState("?page=unknown").page).toBe("events");
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?event=<script>&h=-4")).toEqual({ page: "events", event: null, h: null });
    expect(parseUrlState("?h=1.5")).toEqual({ page: "events", event: null, h: null });
    expect(parseUrlState("?h=99999")).toEqual({ page: "events", event: null, h: null });
  });

  it("is empty without parameters", () => {
    expect(parseUrlState("")).toEqual({ page: "events", event: null, h: null });
  });
});
