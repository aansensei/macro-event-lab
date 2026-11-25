import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

import { collectOpenDataSizes, collectPublicAssets, PUBLIC_DATA_FILES } from "./publicAssets";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it("lists Parquet files before CSV files in the public data allowlist", () => {
  expect(PUBLIC_DATA_FILES.indexOf("arena_forecasts.parquet"))
    .toBeLessThan(PUBLIC_DATA_FILES.indexOf("arena_forecasts.csv"));
  expect(PUBLIC_DATA_FILES.indexOf("arena_scores.parquet"))
    .toBeLessThan(PUBLIC_DATA_FILES.indexOf("arena_scores.csv"));
  expect(PUBLIC_DATA_FILES.indexOf("revisions.parquet"))
    .toBeLessThan(PUBLIC_DATA_FILES.indexOf("revisions.csv"));
});

it("copies public assets and economic exports while excluding the research archive", () => {
  const root = mkdtempSync(join(tmpdir(), "public-assets-"));
  roots.push(root);
  mkdirSync(join(root, "data", "events"), { recursive: true });
  writeFileSync(join(root, "logo.png"), "fixture image");
  writeFileSync(join(root, "data", "revisions.json"), '{"series": "payrolls"}');
  writeFileSync(join(root, "data", "status.json"), '{"schema_version":1,"sources":[]}');
  writeFileSync(join(root, "data", "arena.json"), '{"schema_version":1,"contestants":[]}');
  writeFileSync(join(root, "data", "briefing.json"), '{"schema_version":1,"releases":[]}');
  writeFileSync(join(root, "data", "reactions.json"), '{"schema_version":1,"rows":[]}');
  writeFileSync(join(root, "data", "calendar.ics"), "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
  writeFileSync(join(root, "data", "feed.xml"), '<?xml version="1.0" encoding="utf-8"?><feed/>');
  writeFileSync(join(root, "data", "arena_forecasts.parquet"), "PAR1");
  writeFileSync(join(root, "data", "arena_scores.parquet"), "PAR1");
  writeFileSync(join(root, "data", "revisions.parquet"), "PAR1");
  writeFileSync(join(root, "data", "arena_forecasts.csv"), "target,period\n");
  writeFileSync(join(root, "data", "arena_scores.csv"), "target,contestant_id\n");
  writeFileSync(join(root, "data", "revisions.csv"), "series,label\n");
  writeFileSync(join(root, "data", "manifest.json"), '{"source": "research fixture"}');
  writeFileSync(join(root, "data", "events", "fixture.json"), "{}");
  expect(collectPublicAssets(root).map((asset) => asset.fileName).sort())
    .toEqual([
      "data/arena.json",
      "data/arena_forecasts.csv",
      "data/arena_forecasts.parquet",
      "data/arena_scores.csv",
      "data/arena_scores.parquet",
      "data/briefing.json",
      "data/calendar.ics",
      "data/feed.xml",
      "data/reactions.json",
      "data/revisions.csv",
      "data/revisions.json",
      "data/revisions.parquet",
      "data/status.json",
      "logo.png",
    ]);
  expect(collectOpenDataSizes(root)).toEqual({
    "arena_forecasts.parquet": 4,
    "arena_scores.parquet": 4,
    "revisions.parquet": 4,
    "arena_forecasts.csv": 14,
    "arena_scores.csv": 21,
    "revisions.csv": 13,
  });
});

it("rejects restricted identifiers even in an allowed filename", () => {
  const root = mkdtempSync(join(tmpdir(), "public-assets-"));
  roots.push(root);
  mkdirSync(join(root, "data"));
  writeFileSync(join(root, "data", "revisions.json"), '{"series":"KXPAYROLLS"}');
  expect(() => collectPublicAssets(root)).toThrow("Rebuild public data first");
  expect(collectPublicAssets(join(root, "missing"))).toEqual([]);
  expect(collectOpenDataSizes(join(root, "missing"))).toEqual({});
});
