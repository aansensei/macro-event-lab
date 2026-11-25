import { pageSearch } from "../lib/url";
import { Icon } from "./Icon";

// a card on the Arena page that leads to the play mode, because the play page is not one of the header tabs
export function PlayInvite() {
  return <a className="play-invite" href={pageSearch("play")}>
    <span className="play-invite-text">
      <strong>Can you beat the forecasters?</strong>
      <span>Forecast a past release yourself, using only what was known then, and compare your miss with every contestant.</span>
    </span>
    <Icon name="arrow-right" size={18} className="play-invite-arrow" />
  </a>;
}
