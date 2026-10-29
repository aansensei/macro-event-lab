import { describe, expect, it } from "vitest";

import {
  DataError,
  loadEvent,
  loadManifest,
  loadSummary,
  parseEvent,
  parseManifest,
  parseSummary,
} from "./load";

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

  it("reads the release-day yield reaction", () => {
    const reaction = { date: "2026-10-14", prev_date: "2026-10-13", dgs2_bp: 6, dgs10_bp: 4 };
    expect(parseEvent({ ...event, reaction }).reaction).toEqual(reaction);
  });

  it("treats a missing or null reaction as none", () => {
    expect(parseEvent(event).reaction).toBeNull();
    expect(parseEvent({ ...event, reaction: null }).reaction).toBeNull();
  });

  it("reads the insight and treats a missing one as none", () => {
    const insight = {
      in_50: true, in_90: false, surprise_rank_pct: 0.28, series_n: 58,
      series_hit_50: 0.53, series_hit_90: 0.88, yield_n: 57,
      dgs2_bp_per_sd: 6.06, dgs10_bp_per_sd: 4.12, dgs2_corr: 0.55, dgs10_corr: 0.48,
    };
    expect(parseEvent({ ...event, insight }).insight).toEqual(insight);
    expect(parseEvent(event).insight).toBeNull();
    expect(() => parseEvent({ ...event, insight: { ...insight, in_50: "yes" } })).toThrow(
      "event.insight.in_50",
    );
  });

  it("names a malformed reaction field", () => {
    const reaction = { date: "2026-10-14", prev_date: null, dgs2_bp: "six", dgs10_bp: 4 };
    expect(() => parseEvent({ ...event, reaction })).toThrow("event.reaction.dgs2_bp");
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

describe("parseSummary", () => {
  const summary = {
    schema_version: 1,
    series: [{
      series: "KXCPI", label: "CPI", n: 58, yield_n: 58, hit_50: 0.53, hit_90: 0.88,
      dgs2_bp_per_sd: 6.06, dgs10_bp_per_sd: 4.12, dgs2_corr: 0.55, dgs10_corr: 0.48,
      mean_abs_sd: 0.69,
    }],
    points: [{
      id: "kxcpi-26sep", series: "KXCPI", title: "CPI, September 2026", surprise_sd: 0.24,
      dgs2_bp: 3, dgs10_bp: -2, in_50: true, in_90: true,
    }],
  };

  it("reads series statistics and points", () => {
    const s = parseSummary(summary);
    expect(s.series[0]?.hit_90).toBe(0.88);
    expect(s.points[0]?.id).toBe("kxcpi-26sep");
  });

  it("reads forecast scores and treats missing ones as none", () => {
    expect(parseSummary(summary).series[0]?.scores).toBeNull();
    const scores = {
      n: 57, brier: 0.02, crps: 0.04, mae_market: 0.07, mae_naive: 0.15, skill: 0.53,
      pit_hist: [5, 6, 5, 6, 7, 5, 6, 5, 6, 6],
    };
    const withScores = { ...summary, series: [{ ...summary.series[0], scores }] };
    expect(parseSummary(withScores).series[0]?.scores?.skill).toBe(0.53);
    const bad = { ...summary, series: [{ ...summary.series[0], scores: { ...scores, pit_hist: [1.5] } }] };
    expect(() => parseSummary(bad)).toThrow("summary.series[0].scores.pit_hist");
  });

  it("names a point without a surprise", () => {
    const bad = { ...summary, points: [{ ...summary.points[0], surprise_sd: null }] };
    expect(() => parseSummary(bad)).toThrow("summary.points[0].surprise_sd");
  });

  it("loads summary.json from the data folder", async () => {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(summary));
    }) as typeof fetch;
    const s = await loadSummary("data/", fetchImpl);
    expect(urls).toEqual(["data/summary.json"]);
    expect(s.series).toHaveLength(1);
  });
});
