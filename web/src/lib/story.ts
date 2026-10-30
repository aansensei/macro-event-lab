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
    question: "What was priced in?",
    lead: "One release is a starting point. Does the same pattern hold across other releases?",
  },
  {
    page: "compare",
    label: "Compare",
    question: "Does surprise matter?",
    lead: "A relationship with yields is one test. How do the forecasts score against a simple baseline?",
  },
  {
    page: "scorecard",
    label: "Scorecard",
    question: "Can you trust the forecast?",
    lead: "The scores use the first published result. What happens to that answer as revisions arrive?",
  },
  {
    page: "revisions",
    label: "Revisions",
    question: "Which number is the answer?",
    lead: "Expectations, outcomes and revisions depend on when you look. Method shows how each number is assembled and checked.",
  },
];

export function storyIndex(page: Page): number {
  return STORY.findIndex((s) => s.page === page);
}

export function storyHref(page: Page): string {
  return pageSearch(page);
}

// where the "next" block of a story page leads: the following step, or Method after the last one
export function nextStop(page: Page): { href: string; label: string; question: string } | null {
  const i = storyIndex(page);
  if (i < 0) return null;
  const next = STORY[i + 1];
  if (next) return { href: storyHref(next.page), label: next.label, question: next.question };
  return { href: pageSearch("method"), label: "Method", question: "How every number is made" };
}
