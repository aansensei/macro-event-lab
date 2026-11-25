// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildNotesIndex } from "../lib/notesIndex";
import { About } from "./About";
import { Journal } from "./Journal";
import { Notes } from "./Notes";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FIXTURE_NOTES = buildNotesIndex({
  "../../../notes/2026-12-10_cpi_november.md": "# November CPI\n\nInflation note lead.\n\n## 1. Setup\n\nInflation body.",
  "../../../notes/2026-12-04_payrolls_november.md": "# November payrolls\n\nPayrolls note lead.\n\n## 1. Known\n\nPayrolls body.\n\n## 2. Mechanism\n\nSecond section.",
});

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

describe("Notes page", () => {
  it("shows a single plain sentence when no notes exist", () => {
    const html = renderToStaticMarkup(createElement(Notes, { notes: [] }));
    expect(html).toContain("No notes have been published yet.");
    expect(html).not.toContain("notes-filters");
  });

  it("hides the filter row when only one note exists", () => {
    const html = renderToStaticMarkup(
      createElement(Notes, { notes: FIXTURE_NOTES.slice(0, 1), now: new Date("2026-12-01T00:00:00Z") }),
    );
    expect(html).not.toContain("notes-filters");
    expect(html).toContain("Open, written before the release");
    expect(html).toContain('href="?page=journal"');
  });

  it("shows only populated target filter chips and filters the list with aria-pressed", async () => {
    await act(async () => {
      root.render(createElement(Notes, { notes: FIXTURE_NOTES, now: new Date("2026-12-06T00:00:00Z") }));
    });
    const chips = [...host.querySelectorAll<HTMLButtonElement>(".notes-filter-chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["All", "Payrolls", "Inflation"]);
    expect(chips[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelectorAll(".note-card")).toHaveLength(2);
    expect(host.textContent).toContain("Released, result below");
    expect(host.textContent).toContain("Open, written before the release");

    await act(async () => {
      chips[1]!.click();
    });
    expect(chips[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(chips[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelectorAll(".note-card")).toHaveLength(1);
    expect(host.textContent).toContain("November payrolls");
  });

  it("renders the post view with contents rail, About this note, and neighbouring links", () => {
    const html = renderToStaticMarkup(
      createElement(Notes, {
        slug: "2026-12-04_payrolls_november",
        notes: FIXTURE_NOTES,
        now: new Date("2026-12-01T00:00:00Z"),
      }),
    );
    expect(html).toContain("All notes");
    expect(html).toContain("PAYROLLS");
    expect(html).toContain("November payrolls");
    expect(html).toContain("About this note");
    expect(html).toContain("Open, written before the release");
    expect(html).toContain("section-rail");
    expect(html).toContain("Next note");
    expect(html).not.toContain("Previous note");
  });

  it("renders a plain message with a back link when a slug does not exist", () => {
    const html = renderToStaticMarkup(createElement(Notes, { slug: "does-not-exist", notes: FIXTURE_NOTES }));
    expect(html).toContain("Note not found");
    expect(html).toContain("All notes");
    expect(html).toContain('href="?page=notes"');
  });

  it("links Notes from About and Journal", () => {
    const aboutHtml = renderToStaticMarkup(createElement(About));
    expect(aboutHtml).toContain("Read the economist&#x27;s notes");
    expect(aboutHtml).toContain('href="?page=notes"');
    const journalHtml = renderToStaticMarkup(createElement(Journal));
    expect(journalHtml).toContain('href="?page=notes"');
  });
});
