import { useCallback, useEffect, useMemo, useState } from "react";

import type { Filter } from "../components/EventList";
import { loadManifest } from "../data/load";
import type { Manifest } from "../data/types";
import { urlSearch, type UrlState } from "../lib/url";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; manifest: Manifest };

export function useEventExplorer(route: UrlState) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectionRoute, setSelectionRoute] = useState<UrlState | null>(null);

  useEffect(() => {
    if (route.page !== "events" || state.kind !== "loading") return;
    loadManifest()
      .then((manifest) => setState({ kind: "ready", manifest }))
      .catch((err: Error) => setState({ kind: "error", message: err.message }));
  }, [route.page, state.kind]);

  const events = useMemo(
    () => (state.kind === "ready" ? [...state.manifest.events].reverse() : []),
    [state],
  );

  useEffect(() => {
    if (events.length === 0) return;
    setSelectedId((current) => {
      const linked = events.find((event) => event.id === route.event);
      const retained = events.find((event) => event.id === current);
      return (linked ?? retained ?? events.find((event) => event.surprise_sd !== null) ?? events[0])?.id ?? null;
    });
  }, [events, route]);

  const onHourChange = useCallback((h: number) => {
    if (route.page === "events" && selectedId) {
      window.history.replaceState(null, "", urlSearch(selectedId, h));
    }
  }, [route.page, selectedId]);

  function onSelect(id: string) {
    setSelectionRoute(route);
    setSelectedId(id);
  }

  return {
    state, events, filter,
    initialHour: selectionRoute === route ? null : route.h,
    entry: events.find((event) => event.id === selectedId),
    dataThrough: state.kind === "ready" ? state.manifest.data_through : null,
    onFilter: setFilter, onSelect, onHourChange,
  };
}
