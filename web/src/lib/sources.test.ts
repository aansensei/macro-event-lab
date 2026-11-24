import { expect, it } from "vitest";

import { dataSourcesFor } from "./sources";

it("lists only ingested public sources and their roles", () => {
  expect(dataSourcesFor(true).map(([name]) => name)).toEqual(["ALFRED", "FRED"]);
  expect(dataSourcesFor(true).every(([, href, role]) => href.startsWith("https://") && role.length > 0)).toBe(true);
});

it("preserves all research sources", () => {
  expect(dataSourcesFor(false).map(([name]) => name)).toEqual(["Kalshi", "ALFRED", "FRED", "Federal Reserve"]);
});
