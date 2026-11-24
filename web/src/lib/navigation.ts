import { PUBLIC_EDITION } from "./edition";
import type { Page } from "./url";

type Entry = [Page, string];

// the full research build links every page; the public edition links only pages made from public data
export function navigationFor(isPublic: boolean): { primary: Entry[]; learn: Entry[] } {
  if (isPublic) {
    return {
      primary: [["overview", "Home"], ["revisions", "Revisions"], ["models", "GDP nowcast"], ["about", "About"]],
      learn: [["method", "Method"], ["glossary", "Glossary"]],
    };
  }
  return {
    primary: [
      ["overview", "Overview"], ["events", "Events"], ["compare", "Compare"],
      ["scorecard", "Scorecard"], ["revisions", "Revisions"], ["about", "About"],
    ],
    learn: [["models", "Models"], ["method", "Method"], ["glossary", "Glossary"]],
  };
}

const NAVIGATION = navigationFor(PUBLIC_EDITION);
export const PRIMARY: Entry[] = NAVIGATION.primary;
export const LEARN: Entry[] = NAVIGATION.learn;
