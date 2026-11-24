import { lazy, Suspense } from "react";

import { AppShell, type AppNavigation } from "../components/AppShell";
import { useEventExplorer } from "../hooks/useEventExplorer";
import { About } from "./About";
import { Glossary } from "./Glossary";
import { Method } from "./Method";
import { Models } from "./Models";
import { Overview } from "./Overview";
import { Revisions } from "./Revisions";
import { Status } from "./Status";
import { Arena } from "./Arena";
import { Data } from "./Data";
import { Play } from "./Play";

const Events = /* @__PURE__ */ lazy(() => import("./Events").then((page) => ({ default: page.Events })));
const Compare = /* @__PURE__ */ lazy(() => import("./Compare").then((page) => ({ default: page.Compare })));
const Scorecard = /* @__PURE__ */ lazy(() => import("./Scorecard").then((page) => ({ default: page.Scorecard })));

export function MarketPages(navigation: AppNavigation) {
  const { route, navigationKey } = navigation;
  const explorer = useEventExplorer(route);
  return <AppShell {...navigation} eventTitle={explorer.entry?.title}
    dataThrough={route.page === "events" ? explorer.dataThrough : null}>
    <Suspense fallback={<p role="status">Loading page</p>}>
      {route.page === "overview" && <Overview />}
      {route.page === "events" && <Events {...explorer} navigationKey={navigationKey} />}
      {route.page === "compare" && <Compare />}
      {route.page === "scorecard" && <Scorecard />}
      {route.page === "revisions" && <Revisions />}
      {route.page === "status" && <Status />}
      {route.page === "data" && <Data />}
      {route.page === "play" && <Play />}
      {route.page === "arena" && <Arena />}
      {route.page === "models" && <Models />}
      {route.page === "method" && <Method />}
      {route.page === "glossary" && <Glossary />}
      {route.page === "about" && <About />}
    </Suspense>
  </AppShell>;
}
