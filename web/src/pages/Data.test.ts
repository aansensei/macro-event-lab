// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { OPEN_DATA_FILES } from "../lib/openData";
import { Data } from "./Data";

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

it("renders the lead sentence, Parquet and CSV links in order, sizes table, query section, and attribution", async () => {
  const sizes = {
    "arena_forecasts.parquet": 12000,
    "arena_forecasts.csv": 48000,
    "arena_scores.parquet": 3200,
    "arena_scores.csv": 8400,
    "revisions.parquet": 6400,
    "revisions.csv": 19200,
  };
  await act(async () => root.render(createElement(Data, { fileSizes: sizes })));
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.textContent).toContain("Open data");
  expect(host.textContent).toContain(
    "Analytical tables are published as Parquet: typed, compressed and columnar. CSV copies are provided for spreadsheet programs.",
  );
  for (const entry of OPEN_DATA_FILES) {
    expect(host.textContent).toContain(entry.title);
    const pqLink = host.querySelector<HTMLAnchorElement>(`a[href="data/${entry.parquet}"]`);
    const csvLink = host.querySelector<HTMLAnchorElement>(`a[href="data/${entry.file}"]`);
    expect(pqLink).not.toBeNull();
    expect(csvLink).not.toBeNull();
    expect(pqLink?.textContent).toContain("Recommended for analysis");
    expect(csvLink?.textContent).toContain("For spreadsheets");
    const links = Array.from(pqLink!.parentElement!.querySelectorAll("a"));
    expect(links.indexOf(pqLink!)).toBeLessThan(links.indexOf(csvLink!));
  }
  expect(host.textContent).toContain("File sizes");
  expect(host.textContent).toContain("11.7 KB");
  expect(host.textContent).toContain("46.9 KB");
  expect(host.textContent).toContain("Query it without downloading");
  expect(host.textContent).toContain(
    `SELECT contestant, rmse FROM 'https://aansensei.dev/macro-event-lab/data/arena_scores.parquet' WHERE target = 'gdp' AND "window" = 'all' ORDER BY rmse;`,
  );
  expect(host.textContent).toContain("polars.read_parquet");
  expect(host.textContent).toContain("DuckDB reads only the columns it needs");
  expect(host.textContent).toContain("Survey of Professional Forecasters");
  expect(host.textContent).toContain("Federal Reserve Bank of Philadelphia");
  expect(host.textContent).toContain("Results are preliminary. No file ranks the contestants.");
});
