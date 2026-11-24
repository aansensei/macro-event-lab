import { loadRevisions, loadSummary } from "../data/load";
import { useResource } from "../hooks/useResource";
import { overviewFindings, releaseExamples, revisionHook } from "../lib/overview";
import { STORY, storyHref } from "../lib/story";
import { RevisionReveal } from "../components/RevisionReveal";
import { SiteGuide } from "../components/SiteGuide";
import { EventReveal } from "../components/EventReveal";
import { ResourceError } from "../components/ResourceError";
import { urlSearch } from "../lib/url";

export function Overview() {
  const market = useResource(loadSummary);
  const revisions = useResource(loadRevisions);
  const summary = market.state.kind === "ready" ? market.state.data : null;
  const revisionData = revisions.state.kind === "ready" ? revisions.state.data : null;
  const findings = overviewFindings(summary, revisionData);
  const example = revisionData ? revisionHook(revisionData) : null;
  const examples = summary ? releaseExamples(summary) : [];
  return <div className="overview-page page-fade">
    <header className="overview-intro">
      <div className="hero-copy">
      <p className="overview-masthead"><span>Macro Event Lab</span><span className="mono">Point in time research</span></p>
      <h1>What catches<span>markets off guard?</span></h1>
      <p className="about-lead">Step inside a US economic release: what markets expected, what was first published, and how Treasury yields moved that day.</p>
      <div className="hero-actions">
        {examples[0] && <a className="hero-start" href={urlSearch(examples[0].point.id, 1, 0)}>Open a release file</a>}
        <a className="overview-secondary" href="?page=events">Explore all releases</a>
      </div>
      </div>
      {summary ? <EventReveal examples={examples} /> : <div className={`event-preview-loading${market.state.kind === "loading" ? " is-loading" : ""}`}>
        {market.state.kind === "error" ? <ResourceError title="The release preview could not be loaded" message={market.state.message} onRetry={market.retry} />
          : <><p role="status">Loading a real release</p><div className="preview-skeleton" aria-hidden="true">
            <span /><span /><span /><span />
          </div></>}
      </div>}
    </header>
    <section aria-labelledby="overview-findings">
      <div className="overview-section-heading"><p className="section-kicker">The wider record</p>
      <h2 className="t-h2" id="overview-findings">One surprise is a story.<br />A history is a test.</h2></div>
      <div className="overview-findings">{findings.map((f, i) => <article key={f.title}>
        <h3 className="t-label muted">{f.title}</h3>
        {(i === 2 ? revisions.state : market.state).kind === "ready" ? <><p className="finding-value num">{f.value}</p><p>{f.detail}</p></>
          : <p className="muted" role="status">{(i === 2 ? revisions.state : market.state).kind === "loading" ? "Loading this finding" : "This source is unavailable. Try loading it again."}</p>}
        <a className="finding-link" href={`?page=${["compare", "scorecard", "revisions"][i]}`}>See the evidence</a>
      </article>)}</div>
      <p className="t-micro muted">Market findings use Kalshi data in this local research preview. Publication awaits written permission.</p>
    </section>
    <section className="overview-story" aria-labelledby="overview-story">
      <div className="overview-section-heading"><p className="section-kicker">Four questions. One trail.</p>
      <h2 className="t-h2" id="overview-story">Follow the evidence.</h2></div>
      <div className="story-cards">{STORY.map((step, i) => <a className="story-card" href={storyHref(step.page)} key={step.page}>
        <span className="story-index mono" aria-hidden="true">0{i + 1}</span>
        <div className="story-card-copy"><span className="section-kicker">{step.label}</span><h3>{step.question}</h3>
        <span className="story-card-action">Explore {step.label}</span></div>
        <svg className="story-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </a>)}</div>
    </section>
    {(example || revisions.state.kind !== "ready") && <section className="overview-revisions" aria-labelledby="overview-revisions-title">
      <div><p className="section-kicker">One more twist</p><h2 className="t-h2" id="overview-revisions-title">Even the answer has a history.</h2>
        <p className="muted">A forecast is judged against a first print. Later revisions can change that number, so the site keeps both versions in view.</p>
        <a href="?page=revisions" className="overview-link">Follow the revisions</a></div>
      {example ? <RevisionReveal example={example} /> : revisions.state.kind === "error"
        ? <ResourceError title="The revision example could not be loaded" message={revisions.state.message} onRetry={revisions.retry} />
        : <p role="status">Loading the revision example</p>}
    </section>}
    <SiteGuide />
  </div>;
}
