import { pageSearch, type Page } from "../lib/url";
import { Icon } from "./Icon";

const ITEMS: readonly [Page, string, string][] = [
  [
    "notes",
    "Economist's notes",
    "A prediction and its reasoning, written before each release and never edited afterwards.",
  ],
  [
    "data",
    "Open data",
    "The tables as Parquet and CSV files, and a query you can run on them.",
  ],
  [
    "method",
    "Method",
    "How every number is collected, matched in time and checked.",
  ],
];

// links from the public home to interactive play, downloadable tables and methodology
export function ExploreMore() {
  return (
    <section className="public-explore" aria-labelledby="explore-more">
      <h2 className="t-h2" id="explore-more">Explore more</h2>
      <ul className="public-explore-cards">
        {ITEMS.map(([page, title, text]) => (
          <li key={page}>
            <a className="public-card" href={pageSearch(page)}>
              <span className="public-card-title">{title}</span>
              <span className="public-card-question">{text}</span>
              <Icon name="arrow-right" size={18} className="public-card-arrow" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
