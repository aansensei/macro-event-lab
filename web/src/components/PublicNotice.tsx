import { pageSearch } from "../lib/url";

// shown in the public edition when a link points at a page built on market data
export function PublicNotice() {
  return <div className="public-notice page-fade">
    <h1 className="t-h1">Not published yet</h1>
    <p className="about-lead">
      This page is built on prediction market data. It stays in the private research build until the data
      provider gives written permission to publish figures derived from it.
    </p>
    <p>
      Meanwhile, <a href={pageSearch("revisions")}>Revisions</a> shows how official numbers change after release
      day, and the <a href={pageSearch("models")}>GDP nowcast</a> shows what public data said before each release.
    </p>
  </div>;
}
