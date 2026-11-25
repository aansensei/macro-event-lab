import { describe, expect, it, vi } from "vitest";

import {
  adjacentNotes,
  buildNotesIndex,
  estimateReadingMinutes,
  extractExcerpt,
  extractSections,
  getNoteBySlug,
  NOTES,
  noteStatus,
  parseNoteFilename,
} from "./notesIndex";

describe("notesIndex", () => {
  it("parses valid note file names and rejects malformed ones", () => {
    expect(parseNoteFilename("../../../notes/2026-12-04_payrolls_november.md")).toEqual({
      slug: "2026-12-04_payrolls_november",
      releaseDate: "2026-12-04",
      target: "payrolls",
      period: "november",
    });
    expect(parseNoteFilename("2026-12-10_cpi_november.md")?.target).toBe("cpi");
    expect(parseNoteFilename("2026-12-23_gdp_q3-third.md")?.target).toBe("gdp");
    expect(parseNoteFilename("bad_name.md")).toBeNull();
    expect(parseNoteFilename("2026-13-45_payrolls_november.md")).toBeNull();
    expect(parseNoteFilename("2026-12-04_unknown_november.md")).toBeNull();
  });

  it("extracts the first paragraph after the title and trims at a word boundary only when needed", () => {
    const shortMd = "# Title\n\nShort lead paragraph.\n\n## 1. Next";
    expect(extractExcerpt(shortMd)).toBe("Short lead paragraph.");

    const longLead = "Word ".repeat(45).trim();
    const trimmed = extractExcerpt(`# Title\n\n${longLead}\n\n## 1. Next`, 160);
    expect(trimmed.endsWith("...")).toBe(true);
    expect(trimmed.length).toBeLessThanOrEqual(163);
    expect(trimmed.slice(0, -3).endsWith("Word")).toBe(true);
  });

  it("computes reading minutes at 200 words per minute with a minimum of 1", () => {
    expect(estimateReadingMinutes("")).toBe(1);
    expect(estimateReadingMinutes("one two three")).toBe(1);
    expect(estimateReadingMinutes("word ".repeat(201))).toBe(2);
    expect(estimateReadingMinutes("word ".repeat(400))).toBe(2);
    expect(estimateReadingMinutes("word ".repeat(401))).toBe(3);
  });

  it("computes open and released status from the UTC release timestamp", () => {
    expect(noteStatus("2026-12-04T13:30:00Z", new Date("2026-12-04T13:29:59Z"))).toBe("open");
    expect(noteStatus("2026-12-04T13:30:00Z", new Date("2026-12-04T13:30:00Z"))).toBe("released");
  });

  it("sorts notes newest first, skips invalid names with an error log, and finds neighbours", () => {
    const onError = vi.fn();
    const list = buildNotesIndex(
      {
        "../../../notes/2026-11-06_payrolls_october.md": "# October payrolls\n\nEarlier note.\n\n## 1. Context\n\nBody.",
        "../../../notes/2026-12-10_cpi_november.md": "# November CPI\n\nLatest note.\n\n## 1. Context\n\nBody.",
        "../../../notes/2026-12-04_payrolls_november.md": "# November payrolls\n\nMiddle note.\n\n## 1. Context\n\nBody.",
        "../../../notes/README.md": "# Not a note",
      },
      onError,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(list.map((entry) => entry.slug)).toEqual([
      "2026-12-10_cpi_november",
      "2026-12-04_payrolls_november",
      "2026-11-06_payrolls_october",
    ]);
    expect(adjacentNotes(list, "2026-12-04_payrolls_november")).toEqual({
      previous: list[2],
      next: list[0],
    });
    expect(adjacentNotes(list, "2026-12-10_cpi_november").next).toBeNull();
    expect(adjacentNotes(list, "2026-11-06_payrolls_october").previous).toBeNull();
    expect(getNoteBySlug("2026-12-04_payrolls_november", list)?.title).toBe("November payrolls");
  });

  it("loads the real note from notes/ and extracts its five numbered sections", () => {
    const note = getNoteBySlug("2026-12-04_payrolls_november", NOTES);
    expect(note).toBeDefined();
    expect(note!.target).toBe("payrolls");
    expect(note!.releaseDate).toBe("2026-12-04");
    expect(extractSections(note!.body)).toHaveLength(5);
  });
});
