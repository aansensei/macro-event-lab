import { useEffect, useState } from "react";

import type { Page } from "../lib/url";

type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "mel-theme-pref";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPref(): ThemePref {
  const value = document.documentElement.getAttribute("data-theme-pref");
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme-pref", pref);
}

// System follows the operating system and keeps following it while the page is open
function ThemeSwitch() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    applyTheme(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      // private windows may block storage; the choice then lasts for this page only
    }
    if (pref !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  return (
    <div className="theme-group" role="group" aria-label="Color theme">
      {(["system", "light", "dark"] as const).map((p) => (
        <button
          key={p}
          type="button"
          className="theme-btn"
          aria-pressed={pref === p}
          onClick={() => {
            // colors cross-fade for a moment after a click, not on the first paint
            const root = document.documentElement;
            root.classList.add("theme-switching");
            window.setTimeout(() => root.classList.remove("theme-switching"), 350);
            setPref(p);
          }}
        >
          {p[0]?.toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

const PAGES: [Page, string][] = [
  ["events", "Events"],
  ["method", "Method"],
  ["glossary", "Glossary"],
  ["about", "About"],
];

export function Header({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="logo-slot" href="./" aria-label="Macro Event Lab home">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Macro Event Lab" width="70" height="36" />
        </a>
        <nav className="header-nav" aria-label="Primary navigation">
          {PAGES.map(([p, label]) => (
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
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}
