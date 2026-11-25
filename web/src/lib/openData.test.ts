import { expect, it } from "vitest";

import { formatFileSize, OPEN_DATA_FILES } from "./openData";

it("lists the three open data Parquet and CSV files in contract order", () => {
  expect(OPEN_DATA_FILES.map((entry) => entry.parquet)).toEqual([
    "arena_forecasts.parquet",
    "arena_scores.parquet",
    "revisions.parquet",
  ]);
  expect(OPEN_DATA_FILES.map((entry) => entry.file)).toEqual([
    "arena_forecasts.csv",
    "arena_scores.csv",
    "revisions.csv",
  ]);
});

it("formats byte sizes read from the build", () => {
  expect(formatFileSize(undefined)).toBe("Pending build");
  expect(formatFileSize(512)).toBe("512 B");
  expect(formatFileSize(2560)).toBe("2.5 KB");
  expect(formatFileSize(1048576)).toBe("1.00 MB");
});

it("matches the CSV header names in exact order for each file", () => {
  expect(OPEN_DATA_FILES.map((entry) => entry.columns.map((c) => c.name))).toEqual([
    [
      "target",
      "period",
      "made_on",
      "contestant_id",
      "contestant",
      "kind",
      "forecast",
      "first_print",
      "interval_lo",
      "interval_hi",
      "error",
    ],
    [
      "target",
      "contestant_id",
      "contestant",
      "window",
      "n",
      "mae",
      "rmse",
      "coverage_90",
      "dm_vs_naive_p",
    ],
    [
      "series",
      "label",
      "unit",
      "period",
      "first_print",
      "next_print",
      "latest",
      "settled",
    ],
  ]);
});

it("provides non-empty titles, descriptions, and column meanings", () => {
  for (const entry of OPEN_DATA_FILES) {
    expect(entry.title.trim().length).toBeGreaterThan(0);
    expect(entry.description.trim().length).toBeGreaterThan(0);
    for (const column of entry.columns) {
      expect(column.meaning.trim().length).toBeGreaterThan(0);
    }
  }
});
