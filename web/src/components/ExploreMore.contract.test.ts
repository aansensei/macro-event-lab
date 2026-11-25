// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExploreMore } from "./ExploreMore";

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
  vi.restoreAllMocks();
});

describe("ExploreMore", () => {
  it("renders a section headed Explore more with exactly three described links and arrow icons", async () => {
    await act(async () => {
      root.render(createElement(ExploreMore));
    });

    const section = host.querySelector("section");
    expect(section).not.toBeNull();

    const heading = section!.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']");
    expect(heading?.textContent?.trim()).toBe("Explore more");

    const links = [...section!.querySelectorAll<HTMLAnchorElement>("a")];
    expect(links).toHaveLength(3);

    const expected = [
      {
        href: "?page=notes",
        title: "Economist's notes",
        text: "A prediction and its reasoning, written before each release and never edited afterwards.",
      },
      {
        href: "?page=data",
        title: "Open data",
        text: "The tables as Parquet and CSV files, and a query you can run on them.",
      },
      {
        href: "?page=method",
        title: "Method",
        text: "How every number is collected, matched in time and checked.",
      },
    ];

    expected.forEach((item, index) => {
      const link = links[index]!;
      const content = link.textContent ?? "";
      expect(link.getAttribute("href")).toBe(item.href);
      expect(content).toContain(item.title);
      expect(content).toContain(item.text);
      expect(link.querySelector("svg")).not.toBeNull();
    });
  });
});
