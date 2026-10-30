import { BackToTop } from "./components/BackToTop";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { useEventExplorer } from "./hooks/useEventExplorer";
import { useNavigation } from "./hooks/useNavigation";
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

  return <>
    <Header page={route.page} onNavigate={navigate} />
    <main className="main-container" id="app-main" tabIndex={-1}>
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
