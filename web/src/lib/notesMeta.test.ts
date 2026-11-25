import { describe, expect, it } from "vitest";

import { formatReleaseDateTime, isNoteTarget, NOTE_TARGET_META, NOTE_TARGETS, releaseTimestampUtc } from "./notesMeta";

describe("notesMeta", () => {
  it("maps every target to its display label, mono label and UTC release time", () => {
    expect(NOTE_TARGETS).toEqual(["payrolls", "cpi", "gdp"]);
    expect(NOTE_TARGET_META.payrolls).toEqual({ target: "payrolls", label: "Payrolls", monoLabel: "PAYROLLS", releaseTimeUtc: "13:30" });
    expect(NOTE_TARGET_META.cpi).toEqual({ target: "cpi", label: "Inflation", monoLabel: "INFLATION", releaseTimeUtc: "13:30" });
    expect(NOTE_TARGET_META.gdp).toEqual({ target: "gdp", label: "GDP", monoLabel: "GDP", releaseTimeUtc: "13:30" });
  });

  it("validates target names", () => {
    expect(isNoteTarget("payrolls")).toBe(true);
    expect(isNoteTarget("cpi")).toBe(true);
    expect(isNoteTarget("gdp")).toBe(true);
    expect(isNoteTarget("inflation")).toBe(false);
    expect(isNoteTarget("")).toBe(false);
  });

  it("builds UTC release timestamps and display labels", () => {
    expect(releaseTimestampUtc("2026-12-04", "payrolls")).toBe("2026-12-04T13:30:00Z");
    expect(releaseTimestampUtc("2026-12-10", "cpi")).toBe("2026-12-10T13:30:00Z");
    expect(releaseTimestampUtc("2026-12-23", "gdp")).toBe("2026-12-23T13:30:00Z");
    expect(formatReleaseDateTime("2026-12-04", "payrolls")).toBe("Release 2026-12-04, 13:30 UTC");
  });
});
