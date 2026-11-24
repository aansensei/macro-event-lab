import { describe, expect, it } from "vitest";

import { OPEN_DATA_FILES } from "./openData";

type OpenDataFile = {
  file: string;
  title: string;
  description: string;
  columns: { name: string; meaning: string }[];
};

const FILES: readonly OpenDataFile[] = OPEN_DATA_FILES;

const EXPECTED_FILES = [
  {
    file: "arena_forecasts.csv",
    columns: [
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
    unitColumns: ["forecast", "first_print", "interval_lo", "interval_hi", "error"],
    unitPattern: /(percent|percentage points?|thousands of jobs|jobs)/i,
  },
  {
    file: "arena_scores.csv",
    columns: [
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
    unitColumns: ["mae", "rmse"],
    unitPattern: /(percent|percentage points?|thousands of jobs|jobs)/i,
  },
  {
    file: "revisions.csv",
    columns: [
      "series",
      "label",
      "unit",
      "period",
      "first_print",
      "next_print",
      "latest",
      "settled",
    ],
    unitColumns: ["first_print", "next_print", "latest"],
    unitPattern: /(percent|%|jobs)/i,
  },
];

describe("openData contract", () => {
  it("exports exactly the three open data files in contract order", () => {
    expect(FILES.map((entry) => entry.file)).toEqual(
      EXPECTED_FILES.map((expected) => expected.file),
    );
  });

  it("gives every file a non empty title, description, exact columns, and meanings", () => {
    for (const [index, expected] of EXPECTED_FILES.entries()) {
      const entry = FILES[index];
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.description.trim().length).toBeGreaterThan(0);
      expect(entry.columns.map((column) => column.name)).toEqual(expected.columns);
      for (const column of entry.columns) {
        expect(column.meaning.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("states units in the meaning text for numeric columns of each file", () => {
    for (const [index, expected] of EXPECTED_FILES.entries()) {
      const entry = FILES[index];
      expect(entry).toBeDefined();
      if (!entry) {
        continue;
      }
      const byName = new Map(entry.columns.map((column) => [column.name, column.meaning]));
      for (const columnName of expected.unitColumns) {
        const meaning = byName.get(columnName);
        expect(meaning).toBeDefined();
        expect(meaning ?? "").toMatch(expected.unitPattern);
      }
    }
  });
});
