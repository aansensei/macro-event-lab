import { describe, expect, it } from "vitest";

import { refreshLine, type RefreshStatus } from "./refreshLine";

const RUN_URL = "https://github.com/aansensei/macro-event-lab/actions/runs/987654321";

function makeStatus(overrides: Partial<RefreshStatus> = {}): RefreshStatus {
  return {
    generated_at: "2026-11-24T14:41:03Z",
    information_date: "2026-11-24",
    run_url: RUN_URL,
    sources: [{ is_fresh: true }],
    ...overrides,
  };
}

describe("refreshLine contract", () => {
  it("returns the missing state for null status", () => {
    expect(refreshLine(null, "2026-11-24T15:00:00Z")).toEqual({
      state: "missing",
      text: "Refresh time unavailable",
      runUrl: null,
    });
  });

  it("formats generated_at in UTC and returns current when build and sources are fresh", () => {
    const status = makeStatus({
      generated_at: "2026-11-24T14:41:03Z",
      information_date: "2026-11-23",
      run_url: RUN_URL,
      sources: [{ is_fresh: true }],
    });
    expect(refreshLine(status, "2026-11-24T15:00:00Z")).toEqual({
      state: "current",
      text: "Data refreshed 2026-11-24 14:41 UTC. Newest source data: 2026-11-23. Next rebuild about 14:30 UTC.",
      runUrl: RUN_URL,
    });
  });

  it("formats timestamps near UTC midnight without rounding seconds or shifting date", () => {
    const endOfDay = makeStatus({ generated_at: "2026-11-24T23:59:59Z" });
    expect(refreshLine(endOfDay, "2026-11-25T00:05:00Z").text).toBe(
      "Data refreshed 2026-11-24 23:59 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
    );

    const afterMidnight = makeStatus({ generated_at: "2026-11-25T00:05:00Z" });
    expect(refreshLine(afterMidnight, "2026-11-25T01:00:00Z").text).toBe(
      "Data refreshed 2026-11-25 00:05 UTC. Newest source data: 2026-11-24. Next rebuild about 14:30 UTC.",
    );
  });

  it("applies the 26 hour threshold at 25 hours 59 minutes and 26 hours 1 minute", () => {
    const status = makeStatus({
      generated_at: "2026-11-24T14:30:00Z",
      sources: [{ is_fresh: true }],
    });

    expect(refreshLine(status, "2026-11-25T16:29:00Z").state).toBe("current");
    expect(refreshLine(status, "2026-11-25T16:31:00Z").state).toBe("late");
  });

  it("marks state as late when any source has is_fresh equal to false even for a new build", () => {
    const status = makeStatus({
      generated_at: "2026-11-24T14:41:03Z",
      sources: [{ is_fresh: true }, { is_fresh: false }],
    });
    expect(refreshLine(status, "2026-11-24T14:42:00Z").state).toBe("late");
  });

  it("does not treat null is_fresh or an empty sources list as stale", () => {
    const nullOnly = makeStatus({
      generated_at: "2026-11-24T14:41:03Z",
      sources: [{ is_fresh: null }],
    });
    expect(refreshLine(nullOnly, "2026-11-24T15:00:00Z").state).toBe("current");

    const emptySources = makeStatus({
      generated_at: "2026-11-24T14:41:03Z",
      sources: [],
    });
    expect(refreshLine(emptySources, "2026-11-24T15:00:00Z").state).toBe("current");

    const nullAndFalse = makeStatus({
      generated_at: "2026-11-24T14:41:03Z",
      sources: [{ is_fresh: null }, { is_fresh: false }],
    });
    expect(refreshLine(nullAndFalse, "2026-11-24T15:00:00Z").state).toBe("late");
  });

  it("accepts run_url only when it is a non empty string starting with https://", () => {
    expect(refreshLine(makeStatus({ run_url: RUN_URL }), "2026-11-24T15:00:00Z").runUrl).toBe(RUN_URL);
    expect(refreshLine(makeStatus({ run_url: undefined }), "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(refreshLine(makeStatus({ run_url: null }), "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(refreshLine(makeStatus({ run_url: "" }), "2026-11-24T15:00:00Z").runUrl).toBeNull();
    expect(
      refreshLine(
        makeStatus({ run_url: "http://github.com/aansensei/macro-event-lab/actions/runs/1" }),
        "2026-11-24T15:00:00Z",
      ).runUrl,
    ).toBeNull();
    expect(
      refreshLine(makeStatus({ run_url: "javascript:alert(1)" }), "2026-11-24T15:00:00Z").runUrl,
    ).toBeNull();
    expect(
      refreshLine(makeStatus({ run_url: "/actions/runs/1" }), "2026-11-24T15:00:00Z").runUrl,
    ).toBeNull();
  });
});
