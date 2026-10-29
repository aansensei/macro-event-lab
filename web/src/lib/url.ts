// The page, selected event and hour live in the query string so any view can be shared as a link.

export type Page = "events" | "method" | "glossary" | "about";

const OTHER_PAGES: Page[] = ["method", "glossary", "about"];

export interface UrlState {
  page: Page;
  event: string | null;
  h: number | null;
}

const MAX_HOURS = 10_000;

export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const event = params.get("event");
  const raw = params.get("h");
  const h = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  const page = OTHER_PAGES.find((p) => p === params.get("page")) ?? "events";
  return {
    page,
    event: event && /^[a-z0-9-]+$/.test(event) ? event : null,
    h: h !== null && h <= MAX_HOURS ? h : null,
  };
}

export function urlSearch(event: string, h: number): string {
  return `?${new URLSearchParams({ event, h: String(h) }).toString()}`;
}

// link for a page other than the events page, which writes its own link
export function pageSearch(page: Exclude<Page, "events">): string {
  return `?page=${page}`;
}
