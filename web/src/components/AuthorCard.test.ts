import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { AuthorCard } from "./AuthorCard";

const html = renderToStaticMarkup(createElement(AuthorCard));

it("shows the name, the role, the portrait with a description and the fun fact", () => {
  expect(html).toContain("Cao Thien An Nguyen");
  expect(html).toContain("Data Science and Economics, University of Wisconsin-Madison");
  expect(html).toContain('alt="Avatar of Cao Thien An Nguyen"');
  expect(html).toContain("52 plates");
  expect(html).toContain("Revisions since first print: zero.");
});

it("links to the five places, the email without a new tab and the others with one", () => {
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]);
  expect(hrefs).toEqual([
    "https://aansensei.dev",
    "https://www.linkedin.com/in/cao-thien-an-nguyen",
    "https://github.com/aansensei",
    "mailto:cnguyen49@wisc.edu",
    "https://github.com/aansensei/macro-event-lab",
  ]);
  expect(html.match(/target="_blank"/g)).toHaveLength(4);
  expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(4);
});

it("hides the decorative status bar from assistive technology", () => {
  expect(html).toMatch(/class="dossier-bar" aria-hidden="true"/);
});

it("contains no dash used as punctuation in its text", () => {
  const text = html.replace(/<[^>]+>/g, " ");
  expect(text).not.toMatch(/[\u2013\u2014]/);
});

it("labels each link with a short name and keeps the handle as its tooltip", () => {
  for (const label of ["Portfolio", "LinkedIn", "GitHub", "Email", "Source code"]) expect(html).toMatch(new RegExp(`</svg>${label}(<span|</a>)`));
  expect(html).toContain('title="cnguyen49@wisc.edu"');
  expect(html).toContain('title="aansensei.dev"');
});
