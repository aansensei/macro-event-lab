import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { ExploreMore } from "./ExploreMore";

it("renders the Explore more heading and the three destination links", () => {
  const html = renderToStaticMarkup(createElement(ExploreMore));
  expect(html).toContain(">Explore more</h2>");
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  expect(links).toHaveLength(3);
  expect(links.map((m) => m[1])).toEqual(["?page=play", "?page=data", "?page=method"]);
  expect(links[0]![2]).toContain("Beat the forecasters");
  expect(links[0]![2]).toContain("Forecast a past release yourself and compare your miss with the contestants.");
  expect(links[1]![2]).toContain("Open data");
  expect(links[1]![2]).toContain("The tables as Parquet and CSV files, and a query you can run on them.");
  expect(links[2]![2]).toContain("Method");
  expect(links[2]![2]).toContain("How every number is collected, matched in time and checked.");
  for (const match of links) {
    expect(match[2]).toContain("<svg");
  }
});
