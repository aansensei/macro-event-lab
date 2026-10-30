import { useEffect, useState } from "react";
import { loadRevisions, loadSummary } from "../data/load";
import { overviewFindings, revisionHook } from "../lib/overview";
import { STORY, storyHref } from "../lib/story";
import { RevisionReveal } from "../components/RevisionReveal";
import { SiteGuide } from "../components/SiteGuide";

export function Overview() {
  const [findings, setFindings] = useState<ReturnType<typeof overviewFindings> | null>(null);
  const [error, setError] = useState("");
  const [example, setExample] = useState<ReturnType<typeof revisionHook>>(null);
  useEffect(() => {
    let active = true;
    Promise.all([loadSummary(), loadRevisions()]).then(([summary, revisions]) => {
      if (active) {
        setFindings(overviewFindings(summary, revisions));
        setExample(revisionHook(revisions));
      }
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  return <div className="overview-page page-fade">
    <header className="overview-intro">
      <div className="hero-copy">
      <p className="section-kicker">Macro Event Lab</p>
      <h1>Markets had<br />one number.<br /><span>History kept another.</span></h1>
      <p className="about-lead">See what markets expected before US economic releases, what was first published, and how markets reacted.</p>
      <a className="overview-primary" href="?page=events">Explore the evidence</a>
      <a className="overview-secondary" href="#overview-guide">How to read the site</a>
      </div>
      {example && <RevisionReveal example={example} />}
    </header>
    <div className="overview-bridge"><p>Revisions change our view of the past.</p>
      <p className="muted">To understand a market's reaction, start with what was actually known then.</p></div>
    <section aria-labelledby="overview-findings">
      <h2 className="t-h3" id="overview-findings">Three things the data tells us</h2>
      {error && <p role="alert">Findings could not be loaded: {error}</p>}
      {!findings && !error && <p role="status">Loading findings</p>}
      <div className="overview-findings">{findings?.map((f) => <article key={f.title}>
        <h3 className="t-label muted">{f.title}</h3><p className="finding-value num">{f.value}</p>
        <p>{f.detail}</p>
      </article>)}</div>
      <p className="t-micro muted">Market findings use Kalshi data in this local research preview. Publication awaits written permission.</p>
    </section>
    <SiteGuide />
    <section className="overview-story" aria-labelledby="overview-story">
      <h2 className="t-h3" id="overview-story">Follow the story</h2>
      <div className="story-cards">{STORY.map((step, i) => <a className="story-card" href={storyHref(step.page)} key={step.page}>
        <span className="section-kicker">Part {i + 1}</span><h3>{step.label}</h3><p>{step.question}</p>
        <span className="t-label">Explore {step.label}</span>
      </a>)}</div>
    </section>
  </div>;
}
