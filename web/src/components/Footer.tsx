import type { ReactNode } from "react";

import { formatEtDate } from "../lib/format";
import type { Page } from "../lib/url";
import { PRIMARY, LEARN } from "../lib/navigation";
import { PUBLIC_EDITION } from "../lib/edition";
import { dataSourcesFor } from "../lib/sources";
import { ExternalLink } from "./ExternalLink";
import { Logo } from "./Logo";

const REPO = "https://github.com/aansensei/macro-event-lab";

const PAGES: [Page, string][] = [...PRIMARY, ...LEARN];

const SOURCES = dataSourcesFor(PUBLIC_EDITION);

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

// brand, data status and profile links beside explore, data and project columns, then the copyright under a rule
export function Footer({ dataThrough, onNavigate }: Props) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="footer-mark">
            <Logo />
          </div>
          <p className="footer-tagline">
            {PUBLIC_EDITION ? "Forecasts and first-published US macro numbers, checked point in time."
              : "What markets expected before each US macro release, and what happened when the number came out."}
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
            <li><ExternalLink className="footer-link" href={REPO}>Source code</ExternalLink></li>
            <li><ExternalLink className="footer-link" href="https://aansensei.dev/under-construction.html">Build journal</ExternalLink></li>
            <li><ExternalLink className="footer-link" href={`${REPO}/issues`}>Report an issue</ExternalLink></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span className="footer-author">
          <img src={`${import.meta.env.BASE_URL}ncta.png`} alt="ncta" width="42" height="22" draggable={false} />
          <span>&copy; 2026 Cao Thien An Nguyen</span>
        </span>
        <div className="footer-legal">
          <p className="footer-disclaimer">Educational research only. Data and calculations may contain errors. Not investment advice. <a href="?page=about#disclaimer">See disclaimer</a>.</p>
          <p>This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
        </div>
      </div>
    </footer>
  );
}
