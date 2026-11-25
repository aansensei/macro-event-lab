// The page, selected event, note and hour live in the query string so any view can be shared as a link.

export type Page = "overview" | "events" | "compare" | "scorecard" | "revisions" | "method" | "glossary" | "about" | "models" | "status" | "arena" | "data" | "briefing" | "reactions" | "play" | "journal" | "notes";
export type RevealStage = 0 | 1 | 2;

const PAGES: Page[] = ["overview", "events", "compare", "scorecard", "revisions", "method", "glossary", "about", "models", "status", "arena", "data", "briefing", "reactions", "play", "journal", "notes"];

export interface UrlState {
  page: Page;
  event: string | null;
  h: number | null;
  reveal?: RevealStage;
  note?: string;
}

const MAX_HOURS = 10_000;

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const event = params.get("event");
  const raw = params.get("h");
  const h = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const validEvent = event && /^[a-z0-9-]+$/.test(event) ? event : null;
  const reveal = params.get("reveal");
  const note = params.get("note");
  const validNote = note && /^[a-z0-9][a-z0-9_-]*$/.test(note) ? note : null;
  const page = PAGES.find((p) => p === params.get("page")) ?? (validEvent ? "events" : validNote ? "notes" : "overview");
  return {
    page,
    event: validEvent,
    h: h !== null && h <= MAX_HOURS ? h : null,
    ...(reveal === "0" || reveal === "1" ? { reveal: Number(reveal) as RevealStage } : {}),
    ...(validNote ? { note: validNote } : {}),
  };
}

export function urlSearch(event: string, h: number, reveal: RevealStage = 2): string {
  const params = new URLSearchParams({ event, h: String(h) });
  if (reveal < 2) params.set("reveal", String(reveal));
  return `?${params.toString()}`;
}

// link for a page other than the events page, which writes its own link
export function pageSearch(page: Page): string {
  return `?page=${page}`;
}

// link for a single economist's note post
export function noteSearch(slug: string): string {
  const params = new URLSearchParams({ page: "notes", note: slug });
  return `?${params.toString()}`;
}
