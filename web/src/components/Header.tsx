import { useEffect, useState } from "react";

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
          onClick={() => setPref(p)}
        >
          {p[0]?.toUpperCase() + p.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="logo-slot" href="./" aria-label="Macro Event Lab home">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Macro Event Lab" width="70" height="36" />
        </a>
        <ThemeSwitch />
      </div>
    </header>
  );
}
