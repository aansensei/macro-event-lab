import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { defaultSource, syncData } from "./sync-data.mjs";

function tempDir() {
  return mkdtempSync(join(tmpdir(), "mel-sync-"));
}

describe("syncData", () => {
  it("copies the manifest and event files and drops stale ones", () => {
    const source = tempDir();
    const target = tempDir();
    mkdirSync(join(source, "events"));
    writeFileSync(join(source, "manifest.json"), '{"schema_version":1}');
    writeFileSync(join(source, "events", "kxcpi-26sep.json"), "{}");
    writeFileSync(join(target, "stale.json"), "{}");

    syncData(source, target);

    expect(readFileSync(join(target, "manifest.json"), "utf8")).toBe('{"schema_version":1}');
    expect(existsSync(join(target, "events", "kxcpi-26sep.json"))).toBe(true);
    expect(existsSync(join(target, "stale.json"))).toBe(false);
  });

  it("explains how to build the data when it is missing", () => {
    expect(() => syncData(tempDir(), tempDir())).toThrow(/macro_event_lab build/);
  });

  it("follows MEL_DATA_DIR like the pipeline does", () => {
    expect(defaultSource({ MEL_DATA_DIR: join("x", "y") })).toBe(join("x", "y", "web"));
  });
});
