import { pageSearch } from "../lib/url";
import { Icon } from "./Icon";

// a card on the Arena page that leads from the scores to the written reasoning behind a forecast
export function NotesInvite() {
  return <a className="play-invite" href={pageSearch("notes")}>
    <span className="play-invite-text">
      <strong>Read the reasoning behind a forecast</strong>
      <span>The economist's notes state a prediction and why, before a release, and are never edited afterwards.</span>
    </span>
    <Icon name="arrow-right" size={18} className="play-invite-arrow" />
  </a>;
}
