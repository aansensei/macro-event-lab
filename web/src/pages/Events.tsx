import { EventList } from "../components/EventList";
import { Explorer } from "../components/Explorer";
import { ResourceError } from "../components/ResourceError";
import type { useEventExplorer } from "../hooks/useEventExplorer";

export function Events({ state, events, entry, dataThrough, filter, initialHour, onFilter, onSelect, onHourChange, revealStage, onRevealChange, onRetry, navigationKey }: ReturnType<typeof useEventExplorer> & { navigationKey: number }) {
  if (state.kind === "loading") return <p className="t-label">Loading events</p>;
  if (state.kind === "error") return <ResourceError heading="h1" title="The event list could not be loaded" message={state.message} onRetry={onRetry} />;
  if (events.length === 0) return <section className="state-banner">
    <h1 className="t-h3">No releases in this dataset</h1>
    <p>The event list is empty. Try loading it again or explore the other story pages.</p>
    <button type="button" className="play-btn" onClick={(event) => {
      event.currentTarget.closest<HTMLElement>("main")?.focus({ preventScroll: true });
      onRetry();
    }}>Reload event list</button>
  </section>;
  if (!entry) return <p role="status">Selecting a release</p>;

  return <div className="explorer-layout">
    <EventList events={events} dataThrough={dataThrough} selectedId={entry.id}
      filter={filter} onFilter={onFilter} onSelect={onSelect} hideResults={revealStage === 0} />
    <Explorer key={`${entry.id}:${navigationKey}`} entry={entry} dataThrough={dataThrough}
      initialHour={initialHour} onHourChange={onHourChange} revealStage={revealStage} onRevealChange={onRevealChange} />
  </div>;
}
