import { useEffect, useState } from "react";

import type { Page } from "../lib/url";
import { PRIMARY } from "../lib/navigation";
import { Icon } from "./Icon";
import { LearnMenu } from "./LearnMenu";
import { Logo } from "./Logo";

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
          aria-label={p === "system" ? "Match the device" : p === "light" ? "Light" : "Dark"}
          title={p === "system" ? "Match the device" : p === "light" ? "Light" : "Dark"}
          aria-pressed={pref === p}
          onClick={() => {
            // colors cross-fade for a moment after a click, not on the first paint
            const root = document.documentElement;
            root.classList.add("theme-switching");
            window.setTimeout(() => root.classList.remove("theme-switching"), 350);
            setPref(p);
          }}
        >
          <Icon name={p === "system" ? "monitor" : p === "light" ? "sun" : "moon"} size={18} />
        </button>
      ))}
    </div>
  );
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
          <LearnMenu page={page} onNavigate={onNavigate} />
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}
