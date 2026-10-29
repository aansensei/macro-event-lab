import type { ReactNode } from "react";

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

// each source links to its home page, with what this site takes from it
const SOURCES: [string, string, string][] = [
  ["Kalshi", "https://kalshi.com", "Market prices"],
  ["ALFRED", "https://alfred.stlouisfed.org", "First prints, every vintage"],
  ["FRED", "https://fred.stlouisfed.org", "Treasury yields, release dates"],
  ["Federal Reserve", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "FOMC meeting calendar"],
];

const PROJECT: [string, string][] = [
  ["Source code", REPO],
  ["Build journal", `${REPO}/blob/main/JOURNEY.md`],
  ["Report an issue", `${REPO}/issues`],
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const SOCIAL: [string, string, ReactNode][] = [
  ["GitHub", "https://github.com/aansensei", <Icon key="gh"><polyline points="8 7 3 12 8 17" /><polyline points="16 7 21 12 16 17" /></Icon>],
  ["LinkedIn", "https://www.linkedin.com/in/cao-thien-an-nguyen", <Icon key="in"><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="8" y1="11" x2="8" y2="16" /><line x1="8" y1="8" x2="8" y2="8.01" /><path d="M12 16v-5m0 2.5a2.5 2.5 0 0 1 5 0V16" /></Icon>],
  ["Portfolio", "https://aansensei.dev", <Icon key="web"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>],
];

interface Props {
  dataThrough: string | null;
  onNavigate: (page: Page) => void;
}

// brand, data status and profile links beside explore, data and project columns, then a ruled bottom line
export function Footer({ dataThrough, onNavigate }: Props) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-mark">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width="56" height="28" draggable={false} />
            <span className="footer-name">Macro Event Lab</span>
          </div>
          <p className="footer-tagline">
            What markets expected before each US macro release, and what happened when the number came out.
          </p>
          {dataThrough && (
            <p className="footer-status">
              <span className="footer-status-dot" aria-hidden="true" />
              Data through <span className="num">{formatEtDate(dataThrough)}</span>
            </p>
          )}
          <div className="footer-social">
            {SOCIAL.map(([label, href, icon]) => (
              <a key={label} className="footer-social-btn" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} title={label}>
                {icon}
              </a>
            ))}
            <a className="footer-social-btn" href="mailto:cnguyen49@wisc.edu" aria-label="Email" title="Email">
              <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></Icon>
            </a>
          </div>
        </div>

        <nav className="footer-col" aria-label="Footer">
          <h2 className="footer-head">Explore</h2>
          <ul className="footer-list">
            {PAGES.map(([page, label]) => (
              <li key={page}>
                <button type="button" className="footer-link" onClick={() => onNavigate(page)}>{label}</button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-col">
          <h2 className="footer-head">Data</h2>
          <ul className="footer-list">
            {SOURCES.map(([name, href, role]) => (
              <li key={name} className="footer-source">
                <ExternalLink className="footer-link" href={href}>{name}</ExternalLink>
                <span className="footer-role">{role}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="footer-col">
          <h2 className="footer-head">Project</h2>
          <ul className="footer-list">
            {PROJECT.map(([label, href]) => (
              <li key={label}>
                <ExternalLink className="footer-link" href={href}>{label}</ExternalLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>&copy; 2026 Cao Thien An Nguyen. Built in Madison with Python, DuckDB and React.</span>
        <span>Not investment advice. Not affiliated with Kalshi or the Federal Reserve.</span>
      </div>
    </footer>
  );
}
