// The four pages that tell the site's story, from one release to the yardstick itself.

import { pageSearch, type Page } from "./url";

export interface StoryStep {
  page: Page;
  label: string;
  // the question this page answers, in a few words
  question: string;
  // why a reader goes on to the next page from here
  lead: string;
}

export const STORY: StoryStep[] = [
  {
    page: "events",
    label: "Events",
    question: "One release, hour by hour",
    lead: "You have seen one release. Compare puts it beside every release of the same kind.",
  },
  {
    page: "compare",
    label: "Compare",
    question: "Patterns across every release",
    lead: "Those are the patterns. Scorecard grades the forecasts with the tools forecasters use.",
  },
  {
    page: "scorecard",
    label: "Scorecard",
    question: "How good the forecasts were",
    lead: "Every grade uses the first print as the answer. Revisions shows how much that answer moves later.",
  },
  {
    page: "revisions",
    label: "Revisions",
    question: "Whether the answer itself changes",
    lead: "That is the whole story. Method shows how each number on the site is made.",
  },
];

export function storyIndex(page: Page): number {
  return STORY.findIndex((s) => s.page === page);
}

export function storyHref(page: Page): string {
  return page === "events" ? "./" : pageSearch(page);
}

// where the "next" block of a story page leads: the following step, or Method after the last one
export function nextStop(page: Page): { href: string; label: string; question: string } | null {
  const i = storyIndex(page);
  if (i < 0) return null;
  const next = STORY[i + 1];
  if (next) return { href: storyHref(next.page), label: next.label, question: next.question };
  return { href: pageSearch("method"), label: "Method", question: "How every number is made" };
}
