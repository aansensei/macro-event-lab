import { PUBLIC_EDITION } from "../lib/edition";
import { PRIMARY } from "../lib/navigation";
import type { Page } from "../lib/url";
import { LearnMenu } from "./LearnMenu";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";
import { ThemeSwitch } from "./ThemeSwitch";

export function showsLearnMenu(isPublic: boolean = PUBLIC_EDITION): boolean {
  return !isPublic;
}

export function Header({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="logo-slot" href="./" aria-label="Macro Event Lab home">
          <Logo />
        </a>
        <nav className="header-nav" aria-label="Primary navigation">
          {PRIMARY.map(([p, label]) => (
            <button
              key={p}
              type="button"
              className="nav-btn"
              aria-current={page === p ? "page" : undefined}
              onClick={() => onNavigate(p)}
            >
              {label}
            </button>
          ))}
          {showsLearnMenu() && <LearnMenu page={page} onNavigate={onNavigate} />}
        </nav>
        <ThemeSwitch />
        <MobileMenu page={page} onNavigate={onNavigate} />
      </div>
    </header>
  );
}
