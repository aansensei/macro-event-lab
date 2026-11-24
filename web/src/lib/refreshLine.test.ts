import { describe, expect, it } from "vitest";

import { refreshLine, type RefreshStatus } from "./refreshLine";

const BASE_STATUS: RefreshStatus = {
  generated_at: "2026-11-24T14:30:00Z",
  information_date: "2026-11-24",
  run_url: "https://github.com/aansensei/macro-event-lab/actions/runs/123",
  sources: [{ is_fresh: true }, { is_fresh: true }],
};

describe("refreshLine", () => {
  it("returns missing text and null link when status is null", () => {
    expect(refreshLine(null, "2026-11-24T15:00:00Z")).toEqual({
      state: "missing",
      text: "Refresh time unavailable",
      runUrl: null,
    });
  });

  it("reports current when age is at or under 26 hours and sources are fresh", () => {
    expect(refreshLine(BASE_STATUS, "2026-11-25T16:29:00Z")).toEqual({
      state: "current",
      text: "Data refreshed 2026-11-24 14:30 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
      runUrl: "https://github.com/aansensei/macro-event-lab/actions/runs/123",
    });
    expect(refreshLine(BASE_STATUS, "2026-11-25T16:30:00Z").state).toBe("current");
  });

  it("reports late when age is just over 26 hours", () => {
    expect(refreshLine(BASE_STATUS, "2026-11-25T16:31:00Z").state).toBe("late");
  });

  it("reports late when any source has is_fresh equal to false", () => {
    const stale: RefreshStatus = {
      ...BASE_STATUS,
      sources: [{ is_fresh: true }, { is_fresh: false }],
    };
    expect(refreshLine(stale, "2026-11-24T15:00:00Z").state).toBe("late");
  });

  it("does not count a source with is_fresh equal to null as stale", () => {
    const unknownFreshness: RefreshStatus = {
      ...BASE_STATUS,
      sources: [{ is_fresh: null }, { is_fresh: true }],
    };
    expect(refreshLine(unknownFreshness, "2026-11-24T15:00:00Z").state).toBe("current");
  });

  it("rejects empty or non-https run_url values", () => {
    expect(refreshLine({ ...BASE_STATUS, run_url: "" }, "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(refreshLine({ ...BASE_STATUS, run_url: null }, "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(refreshLine({ ...BASE_STATUS, run_url: "http://github.com/a/b/actions/runs/1" }, "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(refreshLine({ ...BASE_STATUS, run_url: "/actions/runs/1" }, "2026-11-24T15:00:00Z").runUrl).toBeNull();
  });

  it("formats timestamps in UTC around midnight without rounding minutes", () => {
    expect(refreshLine({ ...BASE_STATUS, generated_at: "2026-11-24T23:59:59Z" }, "2026-11-25T00:05:00Z").text).toBe(
      "Data refreshed 2026-11-24 23:59 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
    );
    expect(refreshLine({ ...BASE_STATUS, generated_at: "2026-11-25T00:04:12Z" }, "2026-11-25T01:00:00Z").text).toBe(
      "Data refreshed 2026-11-25 00:04 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
    );
    expect(refreshLine({ ...BASE_STATUS, generated_at: "2026-11-24T23:30:00-05:00" }, "2026-11-25T05:00:00Z").text).toBe(
      "Data refreshed 2026-11-25 04:30 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
    );
  });
});
