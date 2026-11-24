import { useEffect, useRef, type ReactNode } from "react";

import type { useNavigation } from "../hooks/useNavigation";
import { inEdition } from "../lib/edition";
import { LEARN, PRIMARY } from "../lib/navigation";
import { BackToTop } from "./BackToTop";
import { Footer } from "./Footer";
import { Header } from "./Header";

export type AppNavigation = ReturnType<typeof useNavigation>;

export function AppShell({ route, navigate, navigationKey, children, eventTitle, dataThrough = null }:
  AppNavigation & { children: ReactNode; eventTitle?: string; dataThrough?: string | null }) {
  const mainRef = useRef<HTMLElement>(null);
  const label = !inEdition(route.page) ? "Not published yet"
    : [...PRIMARY, ...LEARN].find(([page]) => page === route.page)?.[1] ?? "Overview";
  const title = route.page === "events" ? eventTitle ?? label : label;

  useEffect(() => { document.title = `${title} | Macro Event Lab`; }, [title]);
  useEffect(() => {
    if (navigationKey > 0) mainRef.current?.focus({ preventScroll: true });
  }, [navigationKey]);

  return <>
    <a className="skip-link" href="#app-main" onClick={() => mainRef.current?.focus()}>Skip to content</a>
    <Header page={route.page} onNavigate={navigate} />
    <main className="main-container" id="app-main" ref={mainRef} tabIndex={-1} aria-label={`${label} content`}>
      {children}
    </main>
    <Footer dataThrough={dataThrough} onNavigate={navigate} />
    <BackToTop />
  </>;
}
