import { formatEtDate } from "../lib/format";
import type { Page } from "../lib/url";
import { ExternalLink } from "./ExternalLink";

const REPO = "https://github.com/aansensei/macro-event-lab";

const PAGES: [Page, string][] = [
  ["events", "Events"],
  ["compare", "Compare"],
  ["scorecard", "Scorecard"],
  ["method", "Method"],
  ["glossary", "Glossary"],
  ["about", "About"],
];

interface Props {
  dataThrough: string | null;
  onNavigate: (page: Page) => void;
}

// brand and tagline, then explore, data and project columns, then a bottom line with the copyright
export function Footer({ dataThrough, onNavigate }: Props) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Macro Event Lab" width="56" height="28" draggable={false} />
          <p>What markets expected before each US macro release, and what happened when the number came out.</p>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <h2 className="footer-head">Explore</h2>
          {PAGES.map(([page, label]) => (
            <button key={page} type="button" className="footer-link" onClick={() => onNavigate(page)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="footer-col">
          <h2 className="footer-head">Data</h2>
          {dataThrough && <p className="num">Through {formatEtDate(dataThrough)}</p>}
          <p>Market prices: Kalshi</p>
          <p>First prints: ALFRED, St. Louis Fed</p>
          <p>Treasury yields: FRED</p>
        </div>

        <div className="footer-col">
          <h2 className="footer-head">Project</h2>
          <ExternalLink className="footer-link" href={REPO}>Source code</ExternalLink>
          <ExternalLink className="footer-link" href={`${REPO}/issues`}>Report an issue</ExternalLink>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; 2026 Cao Thien An Nguyen</span>
        <span>Not investment advice. Not affiliated with Kalshi or the Federal Reserve.</span>
      </div>
    </footer>
  );
}
