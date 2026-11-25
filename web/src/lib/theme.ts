import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

const STORAGE_KEY = "mel-theme-pref";
const DARK_QUERY = "(prefers-color-scheme: dark)";
export const THEME_EVENT = "mel-theme-change";

export function readThemePref(): ThemePref {
  const value = document.documentElement.getAttribute("data-theme-pref");
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(pref: ThemePref): void {
  const matchesDark = window.matchMedia?.(DARK_QUERY)?.matches ?? false;
  const dark = pref === "dark" || (pref === "system" && matchesDark);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme-pref", pref);
}

export function setThemePref(pref: ThemePref, animate = true): void {
  if (animate) {
    // colors cross-fade for a moment after a click, not on the first paint
    const root = document.documentElement;
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 350);
  }
  applyTheme(pref);
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // private windows may block storage; the choice then lasts for this page only
  }
  window.dispatchEvent(new CustomEvent<ThemePref>(THEME_EVENT, { detail: pref }));
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(readThemePref);

  useEffect(() => {
    applyTheme(pref);
    const onThemeEvent = () => setPref(readThemePref());
    window.addEventListener(THEME_EVENT, onThemeEvent);
    if (pref !== "system" || !window.matchMedia) {
      return () => window.removeEventListener(THEME_EVENT, onThemeEvent);
    }
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => {
      window.removeEventListener(THEME_EVENT, onThemeEvent);
      media.removeEventListener("change", onChange);
    };
  }, [pref]);

  return [pref, setThemePref];
}
