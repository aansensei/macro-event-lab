import { ExploreMore } from "../components/ExploreMore";
import { ExternalLink } from "../components/ExternalLink";
import { Icon } from "../components/Icon";
import { LiveProof } from "../components/LiveProof";
import { ReleaseFile } from "../components/ReleaseFile";
import { RailPage, type RailSection } from "../components/SectionRail";
import { loadArena } from "../data/arena";
import { loadBriefing } from "../data/briefing";
import { loadLedgerSummary } from "../data/ledger";
import { loadRevisions } from "../data/load";
import { loadNowcast, nowcastErrors } from "../data/nowcast";
import { loadStatus } from "../data/status";
import { useResource } from "../hooks/useResource";
import { formatReleaseDate, periodTitle } from "../lib/briefingWords";
import { liveSentence } from "../lib/nowcastWords";
import { publicFindings } from "../lib/publicFindings";
import { noteForRelease } from "../lib/notesIndex";
import { noteSearch, pageSearch, type Page } from "../lib/url";

const RAIL: RailSection[] = [
  { id: "home-top", label: "Top" },
  { id: "release-file-title", label: "The release file" },
  { id: "live-proof-title", label: "Live proof" },
  { id: "start-here", label: "Start here" },
  { id: "home-next-releases", label: "Next releases" },
  { id: "explore-more", label: "Explore more" },
  { id: "public-findings-title", label: "The wider record" },
];

// the three steps of the public story, each with the reason to open it
const STEPS: [Page, string, string, string][] = [
  ["revisions", "Revisions", "Which number is the answer?", "Every number is published once and then revised. See how much, for jobs, inflation and GDP."],
  ["arena", "Arena", "Who forecasts it best?", "Forecasters and models are scored against the first published number. Results are preliminary."],
  ["models", "GDP nowcast", "Can public data predict GDP?", "One model built only from data published before each release, with its full track record."],
];

// home of the public edition: the live GDP nowcast, the pages built on public data, and why the market pages wait
export function PublicHome() {
  const { state } = useResource(loadNowcast);
  const arena = useResource(loadArena).state;
  const briefing = useResource(loadBriefing).state;
  const revisions = useResource(loadRevisions).state;
  const ledger = useResource(loadLedgerSummary).state;
  const status = useResource(loadStatus).state;
  const data = state.kind === "ready" ? state.data : null;
  const upcoming = briefing.kind === "ready" ? briefing.data.releases.slice(0, 2) : [];
  const upcomingNotes = upcoming.flatMap((release) => {
    const note = noteForRelease(release.target, release.release_date);
    return note ? [note] : [];
  });
  const errors = data && nowcastErrors(data.points);
  return <RailPage sections={RAIL}><div className="public-home page-fade">
    <p className="section-kicker">Macro Event Lab</p>
    <h1 className="t-h1" id="home-top">Every economic number is published once, then revised. Who predicted the first version best?</h1>
    <p className="about-lead">
      This site replays real releases using only what was known at the time, shows how much each number changed
      afterwards, and scores forecasters and models against the first version. It is rebuilt every day from public data.
    </p>

    {arena.kind === "ready" && revisions.kind === "ready" && <ReleaseFile arena={arena.data} revisions={revisions.data} />}

    <LiveProof
      ledger={ledger.kind === "ready" ? ledger.data : null}
      status={status.kind === "ready" ? status.data : null}
      releases={briefing.kind === "ready" ? briefing.data.releases : []} />

    <section className="public-start" aria-labelledby="start-here">
      <h2 className="t-h2" id="start-here">Start here, in three steps</h2>
      <p className="muted public-start-lead">Open them in order. Each page ends by pointing to the next one, and every graph has a note on how to read it.</p>
      <ol className="public-cards">
        {STEPS.map(([page, title, question, reason], index) => <li key={page}>
          <a className="public-card" href={pageSearch(page)}>
            <span className="public-card-number num" aria-hidden="true">{index + 1}</span>
            <span className="public-card-title">{title}: {question}</span>
            <span className="public-card-question">{reason}</span>
            <Icon name="arrow-right" size={18} className="public-card-arrow" />
          </a>
        </li>)}
      </ol>
      <p className="t-micro muted public-start-more">
        Also: <a href={pageSearch("method")}>Method</a> explains how every number is made,{" "}
        <a href={pageSearch("status")}>Data status</a> shows whether the data is fresh, and the{" "}
        <a href={pageSearch("glossary")}>Glossary</a> explains the terms.
      </p>
    </section>

    {upcoming.length > 0 && <section className="public-next-releases" aria-labelledby="home-next-releases">
      <h2 className="t-h2" id="home-next-releases">Next releases</h2>
      <div className="public-release-cards">
        {upcoming.map((release) => <a className="public-card" key={`${release.target}:${release.period}`} href={pageSearch("briefing")}>
          <span className="public-card-title">{release.label}</span>
          <span className="public-card-question">
            {periodTitle(release.target, release.period)}: {release.release_date ? formatReleaseDate(release.release_date) : "Schedule pending"}
          </span>
          <Icon name="arrow-right" size={18} className="public-card-arrow" />
        </a>)}
      </div>
      {upcomingNotes.map((note) => <p key={note.slug} className="public-note-link">
        <a href={noteSearch(note.slug)}>Read the economist's note on the {note.target === "cpi" ? "inflation" : note.target} release of {formatReleaseDate(note.releaseDate)} <Icon name="arrow-right" size={16} /></a>
      </p>)}
      <p className="t-micro muted public-start-more">
        <a href={pageSearch("briefing")}>Open the full release briefing and calendar feeds</a>.
      </p>
    </section>}

    <ExploreMore />

    {(arena.kind === "ready" || revisions.kind === "ready") && <section className="public-findings" aria-labelledby="public-findings-title">
      <p className="section-kicker">The wider record</p>
      <h2 className="t-h2" id="public-findings-title">One release is a story. A history is a test.</h2>
      <div className="overview-findings">
        {publicFindings(arena.kind === "ready" ? arena.data : null, revisions.kind === "ready" ? revisions.data : null).map((f) => <article key={f.title}>
          <h3 className="t-label muted">{f.title}</h3>
          <p className="finding-value num">{f.value}</p>
          <p>{f.detail}</p>
          <a className="finding-link" href={pageSearch(f.page)}>See the evidence <Icon name="arrow-up-right" size={14} /></a>
        </article>)}
      </div>
    </section>}

    {data?.live && <a className="live-card" href={pageSearch("models")}>
      <span className="live-kicker">Live GDP nowcast</span>
      <span className="live-value num">{data.live.nowcast < 0 ? "\u2212" : ""}{Math.abs(data.live.nowcast).toFixed(1)}%</span>
      <span className="live-sentence">{liveSentence(data.live)}</span>
      {errors && <span className="live-record num">
        Past forecasts missed by {errors.model.toFixed(2)} points on average (RMSE), against {errors.naive.toFixed(2)} for
        repeating the previous quarter, over {errors.n} quarters.
      </span>}
    </a>}

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
  </div></RailPage>;
}
