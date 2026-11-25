import type { IconName } from "./Icon";
import { ExternalLink } from "./ExternalLink";
import { Icon } from "./Icon";

const REPO = "https://github.com/aansensei/macro-event-lab";

const LINKS: { icon: IconName; label: string; handle: string; href: string; external: boolean }[] = [
  { icon: "globe", label: "Portfolio", handle: "aansensei.dev", href: "https://aansensei.dev", external: true },
  { icon: "linkedin", label: "LinkedIn", handle: "in/cao-thien-an-nguyen", href: "https://www.linkedin.com/in/cao-thien-an-nguyen", external: true },
  { icon: "github", label: "GitHub", handle: "github.com/aansensei", href: "https://github.com/aansensei", external: true },
  { icon: "mail", label: "Email", handle: "cnguyen49@wisc.edu", href: "mailto:cnguyen49@wisc.edu", external: true },
  { icon: "code", label: "Source code", handle: "github.com/aansensei/macro-event-lab", href: REPO, external: true },
];

// the author profile as a dossier card: a status bar, the portrait with name and role, the story, one fun fact and the links
export function AuthorCard() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="author-dossier">
      <div className="dossier-bar" aria-hidden="true">
        <span className="dossier-dot" />
        <span className="dossier-code">AUTHOR_DOSSIER // ACCESS_GRANTED // 43.07°N (MADISON, WI)</span>
        <span className="dossier-ref">[REF: 2026.11]</span>
      </div>
      <div className="dossier-head">
        <img className="dossier-photo" src={`${base}author.jpg`} alt="Avatar of Cao Thien An Nguyen" width="112" height="112" draggable={false} />
        <div className="dossier-who">
          <p className="dossier-name">
            <span>Cao Thien An Nguyen</span>
            <img className="dossier-mark" src={`${base}ncta.png`} alt="ncta" width="42" height="22" draggable={false} />
          </p>
          <p className="dossier-role">Data Science and Economics, University of Wisconsin-Madison</p>
        </div>
      </div>
      <div className="dossier-story">
        <p className="dossier-bio">
          From Ho Chi Minh City, Vietnam, now in Madison, where the winters are long enough to build a whole data
          pipeline indoors. I <span className="dossier-hl">blend economics with data science</span> to turn raw data
          into stories about the economy that anyone can follow, and I only trust a number after{" "}
          <span className="dossier-hl">checking when it was first published</span>.
        </p>
        <div className="dossier-fact">
          <p className="dossier-fact-kicker">Fun fact // mì xào giòn index (2025)</p>
          <p className="dossier-fact-row">
            <span className="dossier-fact-number">52 plates</span>
            <span className="dossier-fact-text">One plate a week through all of 2025. Revisions since first print: zero.</span>
          </p>
        </div>
      </div>
      <ul className="dossier-links">
        {LINKS.map((link) => <li key={link.label}>
          {link.external
            ? <ExternalLink className="dossier-link" href={link.href} title={link.handle}><Icon name={link.icon} size={18} />{link.label}</ExternalLink>
            : <a className="dossier-link" href={link.href} title={link.handle}><Icon name={link.icon} size={18} />{link.label}</a>}
        </li>)}
      </ul>
    </div>
  );
}
