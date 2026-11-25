import type { Arena } from "../data/arena";
import type { Revisions } from "../data/types";
import { headlineCards } from "../lib/headlineFindings";
import { pageSearch } from "../lib/url";
import { Icon } from "./Icon";

// up to three measured headline facts at the top of the home page, each linking to its evidence
export function HeadlineStrip({ arena, revisions }: { arena: Arena | null; revisions: Revisions | null }) {
  const cards = headlineCards(arena, revisions);
  if (cards.length === 0) return null;
  return (
    <section className="headline-strip" aria-label="Headline findings">
      <ul className="headline-strip-list">
        {cards.map((card) => (
          <li key={card.id} className="headline-card">
            <p className="headline-figure mono num">{card.figure}</p>
            <p className="headline-sentence">{card.sentence}</p>
            <p className="headline-caveat t-micro muted">{card.caveat}</p>
            <a className="headline-link" href={pageSearch(card.page)}>
              See the evidence <Icon name="arrow-right" size={16} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
