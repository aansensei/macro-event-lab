import { AppShell } from "./components/AppShell";
import { PublicNotice } from "./components/PublicNotice";
import { useNavigation } from "./hooks/useNavigation";
import { inEdition } from "./lib/edition";
import { About } from "./pages/About";
import { Glossary } from "./pages/Glossary";
import { MarketPages } from "./pages/marketPages";
import { Method } from "./pages/Method";
import { Models } from "./pages/Models";
import { PublicHome } from "./pages/PublicHome";
import { Revisions } from "./pages/Revisions";
import { Status } from "./pages/Status";
import { Arena } from "./pages/Arena";
import { Data } from "./pages/Data";

export function App() {
  const navigation = useNavigation();
  const { route } = navigation;
  if (import.meta.env.VITE_EDITION !== "public") return <MarketPages {...navigation} />;

  return <AppShell {...navigation}>
    {!inEdition(route.page) && <PublicNotice />}
    {route.page === "overview" && <PublicHome />}
    {route.page === "revisions" && <Revisions />}
    {route.page === "status" && <Status />}
    {route.page === "data" && <Data />}
    {route.page === "arena" && <Arena />}
    {route.page === "models" && <Models />}
    {route.page === "method" && <Method />}
    {route.page === "glossary" && <Glossary />}
    {route.page === "about" && <About />}
  </AppShell>;
}
