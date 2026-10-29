import { useCallback, useEffect, useMemo, useState } from "react";

import { About } from "./components/About";
import { EventList, type Filter } from "./components/EventList";
import { Explorer } from "./components/Explorer";
import { Glossary } from "./components/Glossary";
import { Header } from "./components/Header";
import { Method } from "./components/Method";
import { loadManifest } from "./data/load";
import type { Manifest } from "./data/types";
import { formatEtDate } from "./lib/format";
import { pageSearch, parseUrlState, urlSearch, type Page } from "./lib/url";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; manifest: Manifest };

const fromUrl = parseUrlState(window.location.search);

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [initialHour, setInitialHour] = useState<number | null>(fromUrl.h);
  const [page, setPage] = useState<Page>(fromUrl.page);

  // the events page writes its own link as the hour changes; the other pages have fixed ones
  function navigate(next: Page) {
    if (next !== "events") window.history.replaceState(null, "", pageSearch(next));
    setInitialHour(null);
    setPage(next);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    loadManifest()
      .then((manifest) => setState({ kind: "ready", manifest }))
      .catch((err: Error) => setState({ kind: "error", message: err.message }));
  }, []);

  // newest first, as the list shows them
  const events = useMemo(
    () => (state.kind === "ready" ? [...state.manifest.events].reverse() : []),
    [state],
  );

  // the shared link wins; otherwise the newest event that already has a surprise to show
  useEffect(() => {
    if (events.length === 0 || selectedId !== null) return;
    const linked = events.find((e) => e.id === fromUrl.event);
    setSelectedId((linked ?? events.find((e) => e.surprise_sd !== null) ?? events[0])?.id ?? null);
  }, [events, selectedId]);

  const onHourChange = useCallback(
    (h: number) => {
      if (selectedId) window.history.replaceState(null, "", urlSearch(selectedId, h));
    },
    [selectedId],
  );

  const entry = events.find((e) => e.id === selectedId);
  const dataThrough = state.kind === "ready" ? state.manifest.data_through : null;

  return (
    <>
      <Header page={page} onNavigate={navigate} />
      <main className="main-container" id="app-main">
        {page === "method" && <Method />}
        {page === "glossary" && <Glossary />}
        {page === "about" && <About />}
        {page === "events" && state.kind === "loading" && <p className="t-label">Loading events</p>}
        {page === "events" && state.kind === "error" && (
          <div className="state-banner" role="alert">
            <h1 className="t-h3" style={{ marginBottom: 8 }}>The event list could not be loaded</h1>
            <p>{state.message}</p>
          </div>
        )}
        {page === "events" && state.kind === "ready" && entry && (
          <div className="explorer-layout">
            <EventList
              events={events}
              dataThrough={dataThrough}
              selectedId={entry.id}
              filter={filter}
              onFilter={setFilter}
              onSelect={(id) => {
                setInitialHour(null);
                setSelectedId(id);
              }}
            />
            <Explorer
              key={entry.id}
              entry={entry}
              dataThrough={dataThrough}
              initialHour={initialHour}
              onHourChange={onHourChange}
            />
          </div>
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div><strong>Macro Event Lab</strong> | What markets expected before each macro release</div>
          {dataThrough && <div>Data through {formatEtDate(dataThrough)}</div>}
          <div>
            Market prices: Kalshi. First prints: ALFRED, Federal Reserve Bank of St. Louis. Not affiliated
            with either.
          </div>
          <div>&copy; 2026 Cao Thien An Nguyen</div>
        </div>
      </footer>
    </>
  );
}
