import { Icon } from "../components/Icon";
import { PageGuide } from "../components/PageGuide";
import { ResourceError } from "../components/ResourceError";
import { RailPage, type RailSection } from "../components/SectionRail";
import { BRIEFING_NOT_BUILT, loadBriefing, type BriefingRelease } from "../data/briefing";
import { useResource } from "../hooks/useResource";
import { daysUntil, formatReleaseDate, periodTitle } from "../lib/briefingWords";
import { noteForRelease } from "../lib/notesIndex";
import { noteSearch, pageSearch } from "../lib/url";

const RAIL: RailSection[] = [
  { id: "briefing-top", label: "Top" },
  { id: "briefing-releases", label: "Upcoming releases" },
  { id: "briefing-feeds", label: "Calendar and feed" },
];

function countdownLabel(releaseDate: string, informationDate: string): string {
  const days = daysUntil(releaseDate, informationDate);
  if (days === 0) return "Scheduled today";
  if (days === 1) return "In 1 day";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "1 day ago";
  return `${Math.abs(days)} days ago`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

function ReleaseCard({ release, informationDate }: { release: BriefingRelease; informationDate: string }) {
  const hasSchedule = release.release_date !== null;
  const note = noteForRelease(release.target, release.release_date);
  return <article className="briefing-card">
    <div className="briefing-card-head">
      <div>
        <p className="t-micro muted">{periodTitle(release.target, release.period)}</p>
        <h3 className="t-h3">{release.label}</h3>
      </div>
      {hasSchedule && release.release_date
        ? <span className="briefing-countdown num">{countdownLabel(release.release_date, informationDate)}</span>
        : <span className="briefing-countdown">Schedule pending</span>}
    </div>
    <p className="briefing-date">
      {hasSchedule && release.release_date
        ? <time dateTime={release.release_date}>{formatReleaseDate(release.release_date)}</time>
        : "Next release date not yet scheduled."}
    </p>
    <p className="t-micro muted">Unit: {release.unit}</p>
    <div className="briefing-forecasts">
      <h4 className="t-label">Current forecasts</h4>
      {release.forecasts.length === 0
        ? <p className="muted">No forecasts are available for this release yet.</p>
        : <ul className="briefing-forecast-list">
          {release.forecasts.map((item) => <li key={item.id}>
            <span>{item.label}</span>
            <span className="num">{formatNumber(item.value)} ({release.unit})</span>
          </li>)}
        </ul>}
    </div>
    <p className="briefing-prior">
      Last first print:{" "}
      <strong className="num">
        {release.last_first_print === null ? "Not available" : `${formatNumber(release.last_first_print)} (${release.unit})`}
      </strong>
    </p>
    {note && <p className="briefing-arena-link briefing-note-link">
      <a href={noteSearch(note.slug)}>Read the economist's note for this release <Icon name="arrow-right" size={16} /></a>
    </p>}
    <p className="briefing-arena-link">
      <a href={pageSearch("arena")}>Compare past accuracy in the Forecast Arena <Icon name="arrow-right" size={16} /></a>
    </p>
  </article>;
}

export function Briefing() {
  const { state, retry } = useResource(loadBriefing);
  if (state.kind !== "ready") {
    return <div className="briefing-page page-fade">
      <p className="section-kicker">Next releases</p>
      <h1 className="t-h1">Upcoming economic releases</h1>
      {state.kind === "loading"
        ? <p className="state-banner" role="status">Loading upcoming release briefing.</p>
        : <ResourceError
          title={state.message.startsWith("Unsupported")
            ? "Unsupported data format"
            : state.message === BRIEFING_NOT_BUILT
              ? "Release briefing is not ready yet"
              : "Release briefing could not be loaded"}
          message={state.message}
          onRetry={retry} />}
    </div>;
  }

  const data = state.data;
  const hasSurvey = data.releases.some((release) => release.forecasts.some((item) => item.id === "spf"));

  return <RailPage sections={RAIL}><div className="briefing-page page-fade">
    <header className="briefing-intro" id="briefing-top">
      <p className="section-kicker">Next releases</p>
      <h1 className="t-h1">Upcoming economic releases</h1>
      <p className="about-lead">
        Each upcoming US release date paired with the forecasts as of{" "}
        <time dateTime={data.information_date}>{data.information_date}</time> and the previous first published number.
      </p>
    </header>
    <PageGuide
      purpose="See the next scheduled release dates, the current forecasts made before publication, and subscribe by calendar or news feed."
      lookAt="The release date and countdown on each card, then compare the current forecasts with the last first print."
      limit="Which contestant will win or what later revisions will look like. Results are preliminary and descriptive only." />

    <section className="briefing-section" aria-labelledby="briefing-releases">
      <h2 className="t-h3" id="briefing-releases">Scheduled releases</h2>
      {data.releases.length === 0
        ? <p className="state-banner">No upcoming releases are listed in the current briefing.</p>
        : <div className="briefing-grid">
          {data.releases.map((release) => <ReleaseCard key={`${release.target}:${release.period}`} release={release} informationDate={data.information_date} />)}
        </div>}
    </section>

    <section className="briefing-section" aria-labelledby="briefing-feeds">
      <h2 className="t-h3" id="briefing-feeds">Subscribe to release updates</h2>
      <p className="muted">
        Download the iCalendar file for your calendar application or follow the Atom news feed. Both files update with every daily rebuild.
      </p>
      <div className="briefing-feed-links">
        <a className="briefing-feed-link" href="data/calendar.ics" download="calendar.ics">Add to calendar</a>
        <a className="briefing-feed-link" href="data/feed.xml">News feed</a>
      </div>
    </section>

    {hasSurvey && <p className="muted briefing-credit">
      Professional forecasts: Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters (SPF). Used for non-commercial education and research. This site is independent and is not sponsored, endorsed or approved by the Federal Reserve Bank of Philadelphia.
    </p>}
  </div></RailPage>;
}
