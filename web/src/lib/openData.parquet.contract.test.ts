// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { OPEN_DATA_FILES } from "./openData";
import { Data } from "../pages/Data";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("lists the matching parquet filename for each open data entry", () => {
  const actual = OPEN_DATA_FILES.map((entry) => ({
    file: entry.file,
    parquet: Reflect.get(entry, "parquet"),
  }));
  expect(actual).toEqual([
    { file: "arena_forecasts.csv", parquet: "arena_forecasts.parquet" },
    { file: "arena_scores.csv", parquet: "arena_scores.parquet" },
    { file: "revisions.csv", parquet: "revisions.parquet" },
  ]);
});

it("shows the Parquet lead sentence at the top of the Data page", async () => {
  await act(async () => root.render(createElement(Data)));
  expect(host.textContent).toContain(
    "Analytical tables are published as Parquet: typed, compressed and columnar. CSV copies are provided for spreadsheet programs."
  );
});

it("renders the Parquet link first with Recommended for analysis and CSV second with For spreadsheets", async () => {
  await act(async () => root.render(createElement(Data)));
  const expectedPairs = [
    { parquet: "arena_forecasts.parquet", csv: "arena_forecasts.csv" },
    { parquet: "arena_scores.parquet", csv: "arena_scores.csv" },
    { parquet: "revisions.parquet", csv: "revisions.csv" },
  ];

  for (const pair of expectedPairs) {
    const parquetLink = host.querySelector<HTMLAnchorElement>(`a[href="data/${pair.parquet}"]`);
    const csvLink = host.querySelector<HTMLAnchorElement>(`a[href="data/${pair.csv}"]`);
    expect(parquetLink).not.toBeNull();
    expect(csvLink).not.toBeNull();
    if (parquetLink === null || csvLink === null) {
      continue;
    }
    const order = parquetLink.compareDocumentPosition(csvLink);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const section = parquetLink.closest("section");
    expect(section).not.toBeNull();
    const sectionText = section?.textContent ?? "";
    const recIndex = sectionText.indexOf("Recommended for analysis");
    const sheetIndex = sectionText.indexOf("For spreadsheets");
    expect(recIndex).toBeGreaterThanOrEqual(0);
    expect(sheetIndex).toBeGreaterThanOrEqual(0);
    expect(recIndex).toBeLessThan(sheetIndex);
  }
});
