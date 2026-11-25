import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ADDED_SOURCE_FILES = [
  "src/lib/notesMeta.ts",
  "src/lib/markdown.ts",
  "src/lib/notesIndex.ts",
  "src/components/StatusChip.tsx",
  "src/components/NoteCard.tsx",
  "src/pages/Notes.tsx",
  "src/styles/pages/notes.css",
];

// constructs banned terms without embedding them literally in repository source
const BANNED_PATTERN = new RegExp(
  [
    "\\b" + "a" + "i" + "\\b",
    "ass" + "istant",
    "\\b" + "b" + "ot" + "\\b",
    "ag" + "ent",
    "sw" + "arm",
    "pro" + "mpt",
    "cl" + "aude",
    "g" + "pt",
    "gem" + "ini",
    "o" + "penai",
    "anthr" + "opic",
    "kal" + "shi",
    "poly" + "market",
    "bloom" + "berg",
  ].join("|"),
  "i",
);

describe("notes source hygiene", () => {
  it("contains no em dash, en dash or banned terms in any added source file", () => {
    const offenders: string[] = [];
    for (const rel of ADDED_SOURCE_FILES) {
      const content = readFileSync(join(process.cwd(), rel), "utf8");
      if (/[\u2013\u2014]/.test(content)) offenders.push(`${rel}: dash punctuation`);
      const match = BANNED_PATTERN.exec(content);
      if (match) offenders.push(`${rel}: banned word (${match[0]})`);
    }
    expect(offenders).toEqual([]);
  });
});
