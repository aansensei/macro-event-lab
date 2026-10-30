// The page, selected event and hour live in the query string so any view can be shared as a link.

export type Page = "overview" | "events" | "compare" | "scorecard" | "revisions" | "method" | "glossary" | "about" | "models";
export type RevealStage = 0 | 1 | 2;

const PAGES: Page[] = ["overview", "events", "compare", "scorecard", "revisions", "method", "glossary", "about", "models"];

export interface UrlState {
  page: Page;
  event: string | null;
  h: number | null;
  reveal?: RevealStage;
}

const MAX_HOURS = 10_000;

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const event = params.get("event");
  const raw = params.get("h");
  const h = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const validEvent = event && /^[a-z0-9-]+$/.test(event) ? event : null;
  const reveal = params.get("reveal");
  const page = PAGES.find((p) => p === params.get("page")) ?? (validEvent ? "events" : "overview");
  return {
    page,
    event: validEvent,
    h: h !== null && h <= MAX_HOURS ? h : null,
    ...(reveal === "0" || reveal === "1" ? { reveal: Number(reveal) as RevealStage } : {}),
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
