import { useEffect, useRef } from "react";

import type { ManifestEvent } from "../data/types";
import { KIND_LABEL, seriesKind, signed, type SeriesKind } from "../lib/format";
import { eventStatus } from "../lib/snapshots";
import { Select } from "./Select";

export type Filter = "all" | SeriesKind;

const FILTERS: Filter[] = ["all", "cpi", "jobs", "fomc", "gdp"];

function filterLabel(f: Filter): string {
  return f === "all" ? "All" : KIND_LABEL[f];
}

interface Props {
  events: ManifestEvent[];
  dataThrough: string | null;
  selectedId: string;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onSelect: (id: string) => void;
}

function Badge({ event, dataThrough }: { event: ManifestEvent; dataThrough: string | null }) {
  const status = eventStatus(event, dataThrough);
  if (status === "upcoming") return <span>Upcoming</span>;
  if (status === "not_published") return <span>No outcome</span>;
  if (event.surprise_sd === null) return <span>No surprise</span>;
  const cls = event.surprise_sd > 0 ? "val-surprise-up" : event.surprise_sd < 0 ? "val-surprise-down" : "";
  return <span className={`num ${cls}`}>{signed(event.surprise_sd, 1, " SD")}</span>;
}

// events arrive newest first; the filter only hides rows, it never changes the selection
export function EventList({ events, dataThrough, selectedId, filter, onFilter, onSelect }: Props) {
  const shown = events.filter((e) => filter === "all" || seriesKind(e.series) === filter);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // keeps the selected event visible in the scrolling list, for example after opening a shared link
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId, filter]);

  return (
    <>
      <div className="mobile-event-selectors">
        <Select
          label="Release type"
          value={filter}
          options={FILTERS.map((f) => ({ value: f, label: f === "all" ? "All types" : filterLabel(f) }))}
          onChange={(v) => onFilter(v as Filter)}
        />
        <Select
          label="Event"
          value={selectedId}
          align="end"
          options={[
            // the selected event stays listed even when the filter hides its type
            ...(shown.some((e) => e.id === selectedId) ? [] : events.filter((e) => e.id === selectedId)),
            ...shown,
          ].map((e) => ({ value: e.id, label: e.title, meta: <Badge event={e} dataThrough={dataThrough} /> }))}
          onChange={onSelect}
        />
      </div>

      <aside className="event-sidebar" aria-label="Release filter and event list">
        <div className="t-micro muted" style={{ marginBottom: 6 }}>Release type</div>
        <div className="filter-chips" role="group" aria-label="Filter by release type">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className="chip-btn"
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>
        <div className="sidebar-section-label">Events, newest first ({shown.length})</div>
        <ul className="event-list">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                ref={e.id === selectedId ? selectedRef : undefined}
                type="button"
                className="event-item-btn"
                aria-current={e.id === selectedId}
                onClick={() => onSelect(e.id)}
              >
                <span className="event-item-title">{e.title}</span>
                <span className="event-item-meta">
                  <span>{KIND_LABEL[seriesKind(e.series)]}</span>
                  <Badge event={e} dataThrough={dataThrough} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
