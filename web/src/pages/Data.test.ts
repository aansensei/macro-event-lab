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

it("renders the three file titles, download links, and survey attribution", async () => {
  await act(async () => root.render(createElement(Data)));
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.textContent).toContain("Open data");
  for (const entry of OPEN_DATA_FILES) {
    expect(host.textContent).toContain(entry.title);
    const link = host.querySelector<HTMLAnchorElement>(`a[href="data/${entry.file}"]`);
    expect(link).not.toBeNull();
  }
  expect(host.textContent).toContain("Survey of Professional Forecasters");
  expect(host.textContent).toContain("Federal Reserve Bank of Philadelphia");
  expect(host.textContent).toContain("Results are preliminary. No file ranks the contestants.");
});
