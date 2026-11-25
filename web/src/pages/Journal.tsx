import { RailPage, type RailSection } from "../components/SectionRail";
import { JOURNAL } from "../lib/journal";
import { pageSearch } from "../lib/url";

const RAIL: RailSection[] = [
  { id: "journal-top", label: "Top" },
  ...JOURNAL.map((entry) => ({ id: `journal-${entry.id}`, label: entry.title.length > 34 ? `${entry.title.slice(0, 32)}...` : entry.title })),
];

// the build journal: a short list of moments from the build that show how the project was checked and changed
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
    <p className="t-micro muted"><a href={`${pageSearch("about")}#about-author`}>Back to the author</a></p>
  </div></RailPage>;
}
