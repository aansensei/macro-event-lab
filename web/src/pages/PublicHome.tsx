import { ExternalLink } from "../components/ExternalLink";
import { ReleaseFile } from "../components/ReleaseFile";
import { loadArena } from "../data/arena";
import { loadRevisions } from "../data/load";
import { loadNowcast, nowcastErrors } from "../data/nowcast";
import { useResource } from "../hooks/useResource";
import { liveSentence } from "../lib/nowcastWords";
import { pageSearch, type Page } from "../lib/url";

const CARDS: [Page, string, string][] = [
  ["revisions", "Revisions", "How much did the first published number change later, and when?"],
  ["models", "GDP nowcast", "How well can data already published predict the first GDP release?"],
  ["method", "Method", "How every number is collected, matched in time and checked."],
];

// home of the public edition: the live GDP nowcast, the pages built on public data, and why the market pages wait
export function PublicHome() {
  const { state } = useResource(loadNowcast);
  const arena = useResource(loadArena).state;
  const revisions = useResource(loadRevisions).state;
  const data = state.kind === "ready" ? state.data : null;
  const errors = data && nowcastErrors(data.points);
  return <div className="public-home page-fade">
    <p className="section-kicker">Macro Event Lab</p>
    <h1 className="t-h1">Official numbers, before and after release day</h1>
    <p className="about-lead">
      How the first published US economic numbers change after release day, and a GDP nowcast built only
      from data that was public before each release. Rebuilt automatically from ALFRED vintages.
    </p>

    {arena.kind === "ready" && revisions.kind === "ready" && <ReleaseFile arena={arena.data} revisions={revisions.data} />}

    {data?.live && <a className="live-card" href={pageSearch("models")}>
      <span className="live-kicker">Live GDP nowcast</span>
      <span className="live-value num">{data.live.nowcast < 0 ? "\u2212" : ""}{Math.abs(data.live.nowcast).toFixed(1)}%</span>
      <span className="live-sentence">{liveSentence(data.live)}</span>
      {errors && <span className="live-record num">
        Past forecasts missed by {errors.model.toFixed(2)} points on average (RMSE), against {errors.naive.toFixed(2)} for
        repeating the previous quarter, over {errors.n} quarters.
      </span>}
    </a>}

    <ul className="public-cards">
      {CARDS.map(([page, title, question]) => <li key={page}>
        <a className="public-card" href={pageSearch(page)}>
          <span className="public-card-title">{title}</span>
          <span className="public-card-question">{question}</span>
        </a>
      </li>)}
    </ul>

    <section className="public-note" aria-labelledby="market-pages">
      <h2 className="t-h3" id="market-pages">What prediction markets expected</h2>
      <p>
        The full research build also reconstructs, hour by hour, what prediction markets expected before each
        CPI, jobs, GDP and Fed release. Those pages stay private until the market data provider gives written
        permission to publish figures derived from its data.
      </p>
    </section>

    <p className="public-credit t-micro muted">
      Data: <ExternalLink href="https://alfred.stlouisfed.org/">ALFRED</ExternalLink> and{" "}
      <ExternalLink href="https://fred.stlouisfed.org/">FRED</ExternalLink>, Federal Reserve Bank of St. Louis.
      This product uses the FRED&reg; API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.
    </p>
  </div>;
}
