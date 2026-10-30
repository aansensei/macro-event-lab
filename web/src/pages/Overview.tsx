import { useEffect, useState } from "react";
import { loadRevisions, loadSummary } from "../data/load";
import { overviewFindings, releaseExamples, revisionHook } from "../lib/overview";
import { STORY, storyHref } from "../lib/story";
import { RevisionReveal } from "../components/RevisionReveal";
import { SiteGuide } from "../components/SiteGuide";
import { EventReveal } from "../components/EventReveal";

export function Overview() {
  const [findings, setFindings] = useState<ReturnType<typeof overviewFindings> | null>(null);
  const [error, setError] = useState("");
  const [example, setExample] = useState<ReturnType<typeof revisionHook>>(null);
  const [releases, setReleases] = useState<ReturnType<typeof releaseExamples> | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([loadSummary(), loadRevisions()]).then(([summary, revisions]) => {
      if (active) {
        setFindings(overviewFindings(summary, revisions));
        setExample(revisionHook(revisions));
        setReleases(releaseExamples(summary));
      }
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  return <div className="overview-page page-fade">
    <header className="overview-intro">
      <div className="hero-copy">
      <p className="section-kicker">Macro Event Lab</p>
      <h1>What catches<br /><span>markets off guard?</span></h1>
      <p className="about-lead">Explore market expectations, first prints and daily yield moves for US economic releases.</p>
      <a className="overview-secondary" href="?page=events">Explore all releases</a>
      </div>
      {releases ? <EventReveal examples={releases} /> : <div className="event-preview-loading">
        {error ? <p role="alert">The release preview could not be loaded: {error}</p>
          : <p role="status">Loading a real release</p>}
      </div>}
    </header>
    <section aria-labelledby="overview-findings">
      <p className="section-kicker">Beyond one release</p>
      <h2 className="t-h2" id="overview-findings">What holds up across the data?</h2>
      {!findings && !error && <p role="status">Loading findings</p>}
      <div className="overview-findings">{findings?.map((f, i) => <article key={f.title}>
        <h3 className="t-label muted">{f.title}</h3><p className="finding-value num">{f.value}</p>
        <p>{f.detail}</p>
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
    {example && <section className="overview-revisions" aria-labelledby="overview-revisions-title">
      <div><p className="section-kicker">One more twist</p><h2 className="t-h2" id="overview-revisions-title">Even the answer has a history.</h2>
        <p className="muted">A forecast is judged against a first print. Later revisions can change that number, so the site keeps both versions in view.</p>
        <a href="?page=revisions" className="overview-link">Follow the revisions</a></div>
      <RevisionReveal example={example} />
    </section>}
    <SiteGuide />
  </div>;
}
