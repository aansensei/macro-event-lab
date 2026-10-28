import { describe, expect, it } from "vitest";

import { DataError, loadEvent, loadManifest, parseEvent, parseManifest } from "./load";

const entry = {
  id: "kxcpi-26sep",
  event_ticker: "KXCPI-26SEP",
  series: "KXCPI",
  title: "CPI, September 2026",
  unit: "% m/m",
  close: "2026-10-14T12:29:00Z",
  release_date: "2026-10-14",
  first_print: 0.6,
  surprise: 0.0295,
  surprise_sd: 0.239964,
  file: "events/kxcpi-26sep.json",
  n_snapshots: 1,
};

const manifest = { schema_version: 1, data_through: "2026-10-27T02:00:00Z", events: [entry] };

const event = {
  schema_version: 1,
  id: "kxcpi-26sep",
  event_ticker: "KXCPI-26SEP",
  series: "KXCPI",
  title: "CPI, September 2026",
  unit: "% m/m",
  resolution: 0.1,
  close: "2026-10-14T12:29:00Z",
  release_date: "2026-10-14",
  reference_period: "2026-09-01",
  first_print: 0.6,
  first_print_source: "alfred",
  match_method: "reference_period",
  settled_value: 0.6,
  surprise: 0.0295,
  surprise_sd: 0.239964,
  snapshots: [{
    h: 1, ts: "2026-10-14T11:00:00Z",
    mean: 0.5705, sd: 0.122935, p05: 0.39, p25: 0.52, p50: 0.58, p75: 0.63, p95: 0.74,
    bins: [[null, 0.5, 0.3], [0.5, 0.6, 0.5], [0.6, null, 0.2]],
    survival: [[0.5, 0.71, 0.7], [0.6, 0.2, 0.2]],
  }],
};

function fakeFetch(files: Record<string, unknown>, status = 200): typeof fetch {
  return (async (url: string) =>
    url in files
      ? new Response(JSON.stringify(files[url]), { status })
      : new Response("not found", { status: 404 })) as typeof fetch;
}

describe("parseManifest", () => {
  it("reads a valid manifest", () => {
    const m = parseManifest(manifest);
    expect(m.events).toHaveLength(1);
    expect(m.events[0]?.title).toBe("CPI, September 2026");
  });

  it("rejects another schema version", () => {
    expect(() => parseManifest({ ...manifest, schema_version: 2 })).toThrow(/schema_version 2/);
  });

  it("names the field that is wrong", () => {
    const broken = { ...manifest, events: [{ ...entry, first_print: "0.6" }] };
    expect(() => parseManifest(broken)).toThrow("manifest.events[0].first_print");
  });
});

describe("parseEvent", () => {
  it("reads bins with open ends and the survival curve", () => {
    const e = parseEvent(event);
    expect(e.snapshots[0]?.bins[0]).toEqual([null, 0.5, 0.3]);
    expect(e.snapshots[0]?.survival[1]).toEqual([0.6, 0.2, 0.2]);
  });

  it("accepts an unpublished release", () => {
    const e = parseEvent({ ...event, first_print: null, surprise: null, surprise_sd: null });
    expect(e.first_print).toBeNull();
  });

  it("rejects a probability outside [0, 1]", () => {
    const snap = { ...event.snapshots[0], bins: [[null, 0.5, 1.2]] };
    expect(() => parseEvent({ ...event, snapshots: [snap] })).toThrow("event.snapshots[0].bins[0]");
  });

  it("rejects an unknown first print source", () => {
    expect(() => parseEvent({ ...event, first_print_source: "guess" })).toThrow(DataError);
  });
});

describe("loading over fetch", () => {
  it("loads the manifest and then an event file", async () => {
    const fetcher = fakeFetch({
      "data/manifest.json": manifest,
      "data/events/kxcpi-26sep.json": event,
    });
    const m = await loadManifest("data/", fetcher);
    const e = await loadEvent(m.events[0]!, "data/", fetcher);
    expect(e.snapshots).toHaveLength(1);
  });

  it("reports a missing file with its URL and status", async () => {
    await expect(loadManifest("data/", fakeFetch({}))).rejects.toThrow(
      "Could not load data/manifest.json (HTTP 404)",
    );
  });
});
