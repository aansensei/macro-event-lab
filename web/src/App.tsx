import { useEffect, useRef } from "react";

import { BackToTop } from "./components/BackToTop";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { useEventExplorer } from "./hooks/useEventExplorer";
import { useNavigation } from "./hooks/useNavigation";
import { LEARN, PRIMARY } from "./lib/navigation";
import { About } from "./pages/About";
import { Compare } from "./pages/Compare";
import { Events } from "./pages/Events";
import { Glossary } from "./pages/Glossary";
import { Method } from "./pages/Method";
import { Models } from "./pages/Models";
import { Overview } from "./pages/Overview";
import { Revisions } from "./pages/Revisions";
import { Scorecard } from "./pages/Scorecard";

export function App() {
  const { route, navigate, navigationKey } = useNavigation();
  const explorer = useEventExplorer(route);
  const mainRef = useRef<HTMLElement>(null);
  const label = [...PRIMARY, ...LEARN].find(([page]) => page === route.page)?.[1] ?? "Overview";
  const title = route.page === "events" ? explorer.entry?.title ?? label : label;

  useEffect(() => { document.title = `${title} | Macro Event Lab`; }, [title]);
  useEffect(() => {
    if (navigationKey > 0) mainRef.current?.focus({ preventScroll: true });
  }, [navigationKey]);

  return <>
    <a className="skip-link" href="#app-main" onClick={() => mainRef.current?.focus()}>Skip to content</a>
    <Header page={route.page} onNavigate={navigate} />
    <main className="main-container" id="app-main" ref={mainRef} tabIndex={-1} aria-label={`${label} content`}>
      {route.page === "overview" && <Overview />}
      {route.page === "events" && <Events {...explorer} navigationKey={navigationKey} />}
      {route.page === "compare" && <Compare />}
      {route.page === "scorecard" && <Scorecard />}
      {route.page === "revisions" && <Revisions />}
      {route.page === "models" && <Models />}
      {route.page === "method" && <Method />}
      {route.page === "glossary" && <Glossary />}
      {route.page === "about" && <About />}
    </main>
    <Footer dataThrough={route.page === "events" ? explorer.dataThrough : null} onNavigate={navigate} />
    <BackToTop />
  </>;
}
