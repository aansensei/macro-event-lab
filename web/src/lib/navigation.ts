import { PUBLIC_EDITION } from "./edition";
import type { Page } from "./url";

type Entry = [Page, string];

// the full research build links every page; the public edition links only pages made from public data,
// with Home first and the story pages in the order a visitor should read them
export function navigationFor(isPublic: boolean): { primary: Entry[]; learn: Entry[] } {
  if (isPublic) {
    return {
      primary: [["overview", "Home"], ["revisions", "Revisions"], ["arena", "Arena"], ["models", "GDP nowcast"], ["about", "About"]],
      learn: [["method", "Method"], ["status", "Data status"], ["data", "Open data"], ["glossary", "Glossary"]],
    };
  }
  return {
    primary: [
      ["overview", "Overview"], ["events", "Events"], ["compare", "Compare"],
      ["scorecard", "Scorecard"], ["revisions", "Revisions"], ["about", "About"],
    ],
    learn: [["models", "Models"], ["arena", "Arena"], ["method", "Method"], ["glossary", "Glossary"], ["status", "Data status"]],
  };
}

const NAVIGATION = navigationFor(PUBLIC_EDITION);
export const PRIMARY: Entry[] = NAVIGATION.primary;
export const LEARN: Entry[] = NAVIGATION.learn;
