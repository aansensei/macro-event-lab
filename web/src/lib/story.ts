// The pages that tell the site's story: four in the research build, three in the public edition.

import { PUBLIC_EDITION } from "./edition";
import { pageSearch, type Page } from "./url";

export interface StoryStep {
  page: Page;
  label: string;
  // the question this page answers, in a few words
  question: string;
  // why a reader goes on to the next page from here
  lead: string;
}

const FULL_STORY: StoryStep[] = [
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

const PUBLIC_STORY: StoryStep[] = [
  {
    page: "revisions",
    label: "Revisions",
    question: "Which number is the answer?",
    lead: "A number is published once and then revised. Forecasts are judged against the first version, so how well do forecasters and models predict it?",
  },
  {
    page: "arena",
    label: "Arena",
    question: "Who forecasts it best?",
    lead: "The arena compares many forecasts. The GDP nowcast looks closely at one of them, a model built only from data published before the release.",
  },
  {
    page: "models",
    label: "GDP nowcast",
    question: "Can public data predict GDP?",
    lead: "Method shows how each number is collected, matched in time and checked.",
  },
];

// the public edition tells its own three step story, since it has no market pages
export function storyFor(isPublic: boolean): StoryStep[] {
  return isPublic ? PUBLIC_STORY : FULL_STORY;
}

export const STORY: StoryStep[] = storyFor(PUBLIC_EDITION);

export function storyIndex(page: Page, story: StoryStep[] = STORY): number {
  return story.findIndex((s) => s.page === page);
}

export function storyHref(page: Page): string {
  return pageSearch(page);
}

// where the "next" block of a story page leads: the following step, or Method after the last one
export function nextStop(page: Page, story: StoryStep[] = STORY): { href: string; label: string; question: string } | null {
  const i = storyIndex(page, story);
  if (i < 0) return null;
  const next = story[i + 1];
  if (next) return { href: storyHref(next.page), label: next.label, question: next.question };
  return { href: pageSearch("method"), label: "Method", question: "How every number is made" };
}
