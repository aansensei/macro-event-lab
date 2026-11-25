import { AppShell } from "./components/AppShell";
import { PublicNotice } from "./components/PublicNotice";
import { useNavigation } from "./hooks/useNavigation";
import { inEdition } from "./lib/edition";
import { getNoteBySlug } from "./lib/notesIndex";
import { About } from "./pages/About";
import { Glossary } from "./pages/Glossary";
import { MarketPages } from "./pages/marketPages";
import { Method } from "./pages/Method";
import { Models } from "./pages/Models";
import { PublicHome } from "./pages/PublicHome";
import { Revisions } from "./pages/Revisions";
import { Status } from "./pages/Status";
import { Arena } from "./pages/Arena";
import { Briefing } from "./pages/Briefing";
import { Play } from "./pages/Play";
import { Reactions } from "./pages/Reactions";
import { Data } from "./pages/Data";
import { Journal } from "./pages/Journal";
import { Notes } from "./pages/Notes";

export function App() {
  const navigation = useNavigation();
  const { route } = navigation;
  if (import.meta.env.VITE_EDITION !== "public") return <MarketPages {...navigation} />;

  const noteTitle = route.page === "notes" && route.note ? getNoteBySlug(route.note)?.title : undefined;

  return <AppShell {...navigation} noteTitle={noteTitle}>
    {!inEdition(route.page) && <PublicNotice />}
    {route.page === "overview" && <PublicHome />}
    {route.page === "revisions" && <Revisions />}
    {route.page === "status" && <Status />}
    {route.page === "data" && <Data />}
    {route.page === "briefing" && <Briefing />}
    {route.page === "reactions" && <Reactions />}
    {route.page === "play" && <Play />}
    {route.page === "arena" && <Arena />}
    {route.page === "models" && <Models />}
    {route.page === "method" && <Method />}
    {route.page === "glossary" && <Glossary />}
    {route.page === "about" && <About />}
    {route.page === "journal" && <Journal />}
    {route.page === "notes" && <Notes slug={route.note ?? null} onSelectNote={navigation.openNote} />}
  </AppShell>;
}
