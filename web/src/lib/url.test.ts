import { describe, expect, it } from "vitest";

import { noteSearch, pageSearch, parseUrlState, urlSearch } from "./url";

describe("url state", () => {
  it("shares each reveal state and leaves legacy full-result links unchanged", () => {
    for (const reveal of [0, 1] as const) {
      expect(parseUrlState(urlSearch("cpi-fixture", 24, reveal)))
        .toEqual({ page: "events", event: "cpi-fixture", h: 24, reveal });
    }
    expect(urlSearch("cpi-fixture", 24, 2)).toBe("?event=cpi-fixture&h=24");
    for (const bad of ["no", "-1", "1.5", "9", "2"]) {
      expect(parseUrlState(`?event=cpi-fixture&reveal=${bad}`).reveal).toBeUndefined();
    }
  });
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
    expect(parseUrlState(pageSearch("status")).page).toBe("status");
    expect(parseUrlState(pageSearch("arena")).page).toBe("arena");
    expect(parseUrlState(pageSearch("data")).page).toBe("data");
    expect(parseUrlState(pageSearch("briefing")).page).toBe("briefing");
    expect(parseUrlState(pageSearch("reactions")).page).toBe("reactions");
    expect(parseUrlState(pageSearch("play")).page).toBe("play");
    expect(parseUrlState(pageSearch("notes")).page).toBe("notes");
    expect(parseUrlState("?page=unknown").page).toBe("overview");
  });

  it("round trips a note slug on the notes page and rejects malformed slugs", () => {
    expect(noteSearch("2026-12-04_payrolls_november")).toBe("?page=notes&note=2026-12-04_payrolls_november");
    expect(parseUrlState(noteSearch("2026-12-04_payrolls_november"))).toEqual({
      page: "notes",
      event: null,
      h: null,
      note: "2026-12-04_payrolls_november",
    });
    expect(parseUrlState("?note=2026-12-04_payrolls_november")).toEqual({
      page: "notes",
      event: null,
      h: null,
      note: "2026-12-04_payrolls_november",
    });
    expect(parseUrlState("?page=notes&note=../secret")).toEqual({
      page: "notes",
      event: null,
      h: null,
    });
  });

  it("keeps direct Events, Models and Overview routes", () => {
    for (const page of ["events", "models", "overview"] as const) {
      expect(parseUrlState(pageSearch(page)).page).toBe(page);
    }
    expect(parseUrlState("?event=kxcpi-26sep&h=1").page).toBe("events");
    expect(parseUrlState("?page=models&event=kxcpi-26sep").page).toBe("models");
  });

  it("ignores malformed values", () => {
    expect(parseUrlState("?event=<script>&h=-4")).toEqual({ page: "overview", event: null, h: null });
    expect(parseUrlState("?h=1.5")).toEqual({ page: "overview", event: null, h: null });
    expect(parseUrlState("?h=99999")).toEqual({ page: "overview", event: null, h: null });
  });

  it("opens Overview without parameters", () => {
    expect(parseUrlState("")).toEqual({ page: "overview", event: null, h: null });
  });
});

it("opens on the home page when the address names no page", () => {
  expect(parseUrlState("").page).toBe("overview");
  expect(parseUrlState("?").page).toBe("overview");
});
