import { describe, expect, it } from "vitest";

import { parseUrlState, urlSearch } from "./url";

describe("url state", () => {
  it("round trips an event and hour", () => {
    expect(parseUrlState(urlSearch("kxcpi-26sep", 48))).toEqual({ event: "kxcpi-26sep", h: 48 });
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?event=<script>&h=-4")).toEqual({ event: null, h: null });
    expect(parseUrlState("?h=1.5")).toEqual({ event: null, h: null });
    expect(parseUrlState("?h=99999")).toEqual({ event: null, h: null });
  });

  it("is empty without parameters", () => {
    expect(parseUrlState("")).toEqual({ event: null, h: null });
  });
});
