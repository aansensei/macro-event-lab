import { EventList } from "../components/EventList";
import { Explorer } from "../components/Explorer";
import type { useEventExplorer } from "../hooks/useEventExplorer";

export function Events({ state, events, entry, dataThrough, filter, initialHour, onFilter, onSelect, onHourChange, revealStage, onRevealChange, navigationKey }: ReturnType<typeof useEventExplorer> & { navigationKey: number }) {
  if (state.kind === "loading") return <p className="t-label">Loading events</p>;
  if (state.kind === "error") return <div className="state-banner" role="alert">
    <h1 className="t-h3" style={{ marginBottom: 8 }}>The event list could not be loaded</h1>
    <p>{state.message}</p>
  </div>;
  if (!entry) return null;

  return <div className="explorer-layout">
    <EventList events={events} dataThrough={dataThrough} selectedId={entry.id}
      filter={filter} onFilter={onFilter} onSelect={onSelect} hideResults={revealStage === 0} />
    <Explorer key={`${entry.id}:${navigationKey}`} entry={entry} dataThrough={dataThrough}
      initialHour={initialHour} onHourChange={onHourChange} revealStage={revealStage} onRevealChange={onRevealChange} />
  </div>;
}
