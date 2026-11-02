import { loadRevisions, loadSummary } from "../data/load";
import { useResource } from "../hooks/useResource";
import { overviewFindings, releaseExamples, revisionHook } from "../lib/overview";
import { STORY, storyHref } from "../lib/story";
import { RevisionReveal } from "../components/RevisionReveal";
import { SiteGuide } from "../components/SiteGuide";
import { EventReveal } from "../components/EventReveal";
import { ResourceError } from "../components/ResourceError";

export function Overview() {
  const market = useResource(loadSummary);
  const revisions = useResource(loadRevisions);
  const summary = market.state.kind === "ready" ? market.state.data : null;
  const revisionData = revisions.state.kind === "ready" ? revisions.state.data : null;
  const findings = overviewFindings(summary, revisionData);
  const example = revisionData ? revisionHook(revisionData) : null;
  return <div className="overview-page page-fade">
    <header className="overview-intro">
      <div className="hero-copy">
      <p className="section-kicker">Macro Event Lab</p>
      <h1>What catches<br /><span>markets off guard?</span></h1>
      <p className="about-lead">Explore market expectations, first prints and daily yield moves for US economic releases.</p>
      <a className="overview-secondary" href="?page=events">Explore all releases</a>
      </div>
      {summary ? <EventReveal examples={releaseExamples(summary)} /> : <div className="event-preview-loading">
        {market.state.kind === "error" ? <ResourceError title="The release preview could not be loaded" message={market.state.message} onRetry={market.retry} />
          : <p role="status">Loading a real release</p>}
      </div>}
    </header>
    <section aria-labelledby="overview-findings">
      <p className="section-kicker">Beyond one release</p>
      <h2 className="t-h2" id="overview-findings">What holds up across the data?</h2>
      <div className="overview-findings">{findings.map((f, i) => <article key={f.title}>
        <h3 className="t-label muted">{f.title}</h3>
        {(i === 2 ? revisions.state : market.state).kind === "ready" ? <><p className="finding-value num">{f.value}</p><p>{f.detail}</p></>
          : <p className="muted" role="status">{(i === 2 ? revisions.state : market.state).kind === "loading" ? "Loading this finding" : "This source is unavailable. Try loading it again."}</p>}
        <a className="finding-link" href={`?page=${["compare", "scorecard", "revisions"][i]}`}>See the evidence</a>
      </article>)}</div>
      <p className="t-micro muted">Market findings use Kalshi data in this local research preview. Publication awaits written permission.</p>
    </section>
    <section className="overview-story" aria-labelledby="overview-story">
      <h2 className="t-h2" id="overview-story">Keep following the question.</h2>
      <div className="story-cards">{STORY.map((step, i) => <a className="story-card" href={storyHref(step.page)} key={step.page}>
        <span className="section-kicker">Part {i + 1}</span><h3>{step.label}</h3><p>{step.question}</p>
        <span className="t-label">Explore {step.label}</span>
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
