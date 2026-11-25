import { RailPage, type RailSection } from "../components/SectionRail";
import { JOURNAL, TROUBLES } from "../lib/journal";
import { pageSearch } from "../lib/url";

const RAIL: RailSection[] = [
  { id: "journal-top", label: "Top" },
  ...JOURNAL.map((entry) => ({ id: `journal-${entry.id}`, label: entry.rail })),
  { id: "journal-troubles", label: "What went wrong" },
];

// the build journal: moments from the build, then the things that went wrong with what they cost and how they were fixed
export function Journal() {
  return <RailPage sections={RAIL}><div className="journal page-fade">
    <p className="section-kicker">Build journal</p>
    <h1 className="t-h1" id="journal-top">How this was built, and what went wrong on the way</h1>
    <p className="about-lead">
      A short list of moments from the build: bugs found, rules that had to be written down, and results that were
      not flattering. Every item is backed by the code or the tests in the repository.
    </p>
    <ol className="journal-list">
      {JOURNAL.map((entry) => <li key={entry.id} className="journal-entry" id={`journal-${entry.id}`}>
        <p className="journal-month mono">{entry.month}</p>
        <h2 className="t-h3">{entry.title}</h2>
        {entry.paragraphs.map((text) => <p key={text}>{text}</p>)}
      </li>)}
    </ol>

    <section className="journal-troubles" aria-labelledby="journal-troubles">
      <h2 className="t-h2" id="journal-troubles">Things that went wrong</h2>
      <p className="muted journal-troubles-lead">
        The honest part. Each one says what broke, what it cost, and how it was fixed.
      </p>
      <ol className="journal-list">
        {TROUBLES.map((item) => <li key={item.id} className="journal-entry journal-trouble" id={`trouble-${item.id}`}>
          <h3 className="t-h3">{item.title}</h3>
          <dl className="journal-parts">
            <div><dt>What broke</dt><dd>{item.broke}</dd></div>
            <div><dt>What it cost</dt><dd>{item.cost}</dd></div>
            <div><dt>How it was fixed</dt><dd>{item.fix}</dd></div>
          </dl>
        </li>)}
      </ol>
    </section>

    <p className="t-micro muted">
      <a href={`${pageSearch("about")}#about-author`}>Back to the author</a>
      {" · "}
      <a href={pageSearch("notes")}>Read the economist's notes</a>
    </p>
  </div></RailPage>;
}
