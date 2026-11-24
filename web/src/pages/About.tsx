import { useEffect } from "react";

import { ExternalLink } from "../components/ExternalLink";
import { SectionRail, type RailSection } from "../components/SectionRail";

import { PUBLIC_EDITION } from "../lib/edition";
import { aboutCopyFor } from "../lib/aboutCopy";

const REPO = "https://github.com/aansensei/macro-event-lab";

const RAIL: RailSection[] = [
  { id: "about-top", label: "Top" },
  { id: "about-idea", label: "The idea" },
  { id: "about-why", label: "Why this way" },
  { id: "about-stack", label: "How it is built" },
  { id: "about-author", label: "Author" },
  { id: "about-faq", label: "FAQ" },
  { id: "disclaimer", label: "Disclaimer" },
];

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="about-rows">
      {rows.map(([term, text]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export function About() {
  const copy = aboutCopyFor(PUBLIC_EDITION);
  useEffect(() => {
    if (window.location.hash !== "#disclaimer") return;
    const target = document.getElementById("disclaimer");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);

  return (
    <div className="with-rail">
    <SectionRail sections={RAIL} />
    <article className="about-page page-fade">
      <h1 className="t-h1" id="about-top">About Macro Event Lab</h1>
      <p className="about-lead">{copy.lead}</p>
      <dl className="about-rows glance-rows" aria-label="The project at a glance">
        {copy.glance.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>

      <section className="about-section" aria-labelledby="about-idea">
        <h2 className="t-h2" id="about-idea">The idea</h2>
        <div className="idea-text">{copy.idea.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
        <h3 className="idea-kicker">Questions it answers</h3>
        <ul className="idea-questions">
          {copy.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>

      <p className="about-note" id="about-howto">New here? Start with the <a href="?page=overview#overview-guide">Overview guide</a> to choose a release and explore the data.</p>

      <section className="about-section" aria-labelledby="about-why">
        <h2 className="t-h2" id="about-why">Why it is built this way</h2>
        <Rows rows={copy.why} />
      </section>

      <section className="about-section" aria-labelledby="about-stack">
        <h2 className="t-h2" id="about-stack">How it is built</h2>
        <Rows rows={copy.stack} />
      </section>

      <section className="about-section" aria-labelledby="about-author">
        <h2 className="t-h2" id="about-author">Author</h2>
        <div className="author-card">
          <img
            className="author-photo"
            src={`${import.meta.env.BASE_URL}author.jpg`}
            alt="Avatar of Cao Thien An Nguyen"
            width="96"
            height="96"
            draggable={false}
          />
          <div>
            <p className="author-name">
              Cao Thien An Nguyen
              <img className="author-mark" src={`${import.meta.env.BASE_URL}ncta.png`} alt="ncta" width="42" height="22" draggable={false} />
            </p>
            <p className="author-role">Data Science and Economics, University of Wisconsin-Madison</p>
            <p className="author-bio">
              From Ho Chi Minh City, Vietnam, now in Madison, where the winters are long enough to build a
              whole data pipeline indoors. I blend economics with data science to turn raw data into stories
              about the economy that anyone can follow, and I only trust a number after checking when it was
              first published.
            </p>
            <p className="author-fun">
              <span className="author-fun-tag">Fun fact</span> Runs on crispy fried noodles (mì xào giòn):
              one plate a week through all of 2025, about 52 plates. Revisions to this preference since the
              first print: zero.
            </p>
            <dl className="author-links">
              <div><dt>Portfolio</dt><dd><ExternalLink href="https://aansensei.dev">aansensei.dev</ExternalLink></dd></div>
              <div><dt>LinkedIn</dt><dd><ExternalLink href="https://www.linkedin.com/in/cao-thien-an-nguyen">in/cao-thien-an-nguyen</ExternalLink></dd></div>
              <div><dt>GitHub</dt><dd><ExternalLink href="https://github.com/aansensei">github.com/aansensei</ExternalLink></dd></div>
              <div><dt>Email</dt><dd><a href="mailto:cnguyen49@wisc.edu">cnguyen49@wisc.edu</a></dd></div>
              <div><dt>Code</dt><dd><ExternalLink href={REPO}>github.com/aansensei/macro-event-lab</ExternalLink></dd></div>
            </dl>
          </div>
        </div>
        <p className="about-note">
          Found a mistake or have a question? Open an issue on <ExternalLink href={`${REPO}/issues`}>GitHub</ExternalLink>.
        </p>
      </section>

      <section className="about-section" aria-labelledby="about-faq">
        <h2 className="t-h2" id="about-faq">FAQ</h2>
        <div className="faq-list">
          {copy.faq.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="disclaimer" id="disclaimer" aria-labelledby="disclaimer-title" tabIndex={-1}>
        <h2 className="t-h2" id="disclaimer-title">Disclaimer</h2>
        <div className="disclaimer-body">
          <p>Macro Event Lab is a personal project for education and research.</p>
          <p>{copy.disclaimer[0]}</p>
          <p>{copy.disclaimer[1]}</p>
          <p>{copy.disclaimer[2]}</p>
          <p>See the <ExternalLink href="https://fred.stlouisfed.org/docs/api/terms_of_use.html">FRED data conditions</ExternalLink> for the source's usage requirements. This notice does not grant permission to redistribute third-party data.</p>
          <p>Everything here is provided as is, without any warranty. The author accepts no responsibility for any loss or decision that results from using this site or its data.</p>
        </div>
      </section>
    </article>
    </div>
  );
}
