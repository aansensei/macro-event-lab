import { headingId } from "./markdown";
import { isNoteTarget, releaseTimestampUtc, type NoteTarget } from "./notesMeta";

export type NoteStatus = "open" | "released";

export interface ParsedNoteFilename {
  slug: string;
  releaseDate: string;
  target: NoteTarget;
  period: string;
}

export interface NoteSection {
  id: string;
  label: string;
}

export interface NoteEntry {
  slug: string;
  releaseDate: string;
  releaseTimestamp: string;
  target: NoteTarget;
  period: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  body: string;
  sections: NoteSection[];
}

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})_([a-z]+)_([a-z0-9][a-z0-9_-]*)\.md$/;

function isValidIsoDate(dateStr: string): boolean {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

// parses YYYY-MM-DD_<target>_<period>.md into slug, date, target and period, or returns null on mismatch
export function parseNoteFilename(pathOrName: string): ParsedNoteFilename | null {
  const base = pathOrName.split(/[\\/]/).pop() ?? "";
  const match = FILENAME_RE.exec(base);
  if (!match) return null;
  const releaseDate = match[1] ?? "";
  const rawTarget = match[2] ?? "";
  const period = match[3] ?? "";
  if (!isValidIsoDate(releaseDate) || !isNoteTarget(rawTarget)) return null;
  return {
    slug: base.slice(0, -3),
    releaseDate,
    target: rawTarget,
    period,
  };
}

// strips basic inline markdown markers so card excerpts read as plain prose
function stripInlineFormatting(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(^|[^a-z0-9])_([^_]+)_(?=[^a-z0-9]|$)/gi, "$1$2");
}

// extracts the first paragraph after the title, trimmed near maxLength at a word boundary
export function extractExcerpt(markdown: string, maxLength = 160): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i] ?? "")) i++;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;

  const paraLines: string[] = [];
  while (i < lines.length) {
    const line = (lines[i] ?? "").trim();
    if (line === "" || /^#{1,6}\s+/.test(line) || /^([-*]|\d+\.)\s+/.test(line) || /^\|/.test(line)) break;
    paraLines.push(line);
    i++;
  }

  const plain = stripInlineFormatting(paraLines.join(" ").replace(/\s+/g, " ").trim());
  if (plain.length <= maxLength) return plain;
  const slice = plain.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trimEnd();
  return `${trimmed}...`;
}

// estimates reading time at 200 words per minute, rounded up, at least 1 minute
export function estimateReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function splitTitleAndBody(markdown: string, fallbackTitle: string): { title: string; body: string } {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex === -1) return { title: fallbackTitle, body: markdown.trim() };
  const title = (lines[titleIndex] ?? "").replace(/^#\s+/, "").trim() || fallbackTitle;
  const remaining = [...lines.slice(0, titleIndex), ...lines.slice(titleIndex + 1)].join("\n").replace(/^\n+/, "");
  return { title, body: remaining };
}

// extracts every level-2 heading for the contents rail and mobile sheet
export function extractSections(markdownBody: string): NoteSection[] {
  const sections: NoteSection[] = [];
  for (const line of markdownBody.replace(/\r\n?/g, "\n").split("\n")) {
    const match = /^##\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;
    const label = (match[1] ?? "").trim();
    if (label) sections.push({ id: headingId(label), label });
  }
  return sections;
}

// computes whether a note is still open or past its scheduled release moment
export function noteStatus(releaseTimestamp: string, now: Date = new Date()): NoteStatus {
  return now.getTime() < Date.parse(releaseTimestamp) ? "open" : "released";
}

// builds the sorted index of notes from raw Markdown files, skipping malformed file names
export function buildNotesIndex(
  rawFiles: Record<string, string>,
  onError: (message: string) => void = (message) => console.error(message),
): NoteEntry[] {
  const entries: NoteEntry[] = [];
  for (const [path, raw] of Object.entries(rawFiles)) {
    const parsed = parseNoteFilename(path);
    if (!parsed) {
      onError(`Skipped note file with invalid name: ${path}`);
      continue;
    }
    const { title, body } = splitTitleAndBody(raw, parsed.slug);
    entries.push({
      slug: parsed.slug,
      releaseDate: parsed.releaseDate,
      releaseTimestamp: releaseTimestampUtc(parsed.releaseDate, parsed.target),
      target: parsed.target,
      period: parsed.period,
      title,
      excerpt: extractExcerpt(raw),
      readingMinutes: estimateReadingMinutes(raw),
      body,
      sections: extractSections(body),
    });
  }
  return entries.sort((a, b) => {
    const timeDiff = Date.parse(b.releaseTimestamp) - Date.parse(a.releaseTimestamp);
    return timeDiff !== 0 ? timeDiff : b.slug.localeCompare(a.slug);
  });
}

// returns the older (previous) and newer (next) neighbouring notes in release-date order
export function adjacentNotes(
  notes: readonly NoteEntry[],
  slug: string,
): { previous: NoteEntry | null; next: NoteEntry | null } {
  const index = notes.findIndex((entry) => entry.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: notes[index + 1] ?? null,
    next: notes[index - 1] ?? null,
  };
}

const RAW_NOTES = import.meta.glob("../../../notes/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const NOTES: NoteEntry[] = buildNotesIndex(RAW_NOTES);

// the note written for one scheduled release, found by its target and release date
export function noteForRelease(target: string, releaseDate: string | null, notes: readonly NoteEntry[] = NOTES): NoteEntry | undefined {
  if (releaseDate === null) return undefined;
  return notes.find((entry) => entry.target === target && entry.releaseDate === releaseDate);
}

export function getNoteBySlug(slug: string, notes: readonly NoteEntry[] = NOTES): NoteEntry | undefined {
  return notes.find((entry) => entry.slug === slug);
}
