import type { MouseEvent } from "react";

import { noteStatus, type NoteEntry } from "../lib/notesIndex";
import { formatReleaseDateTime, NOTE_TARGET_META } from "../lib/notesMeta";
import { noteSearch } from "../lib/url";
import { Icon } from "./Icon";
import { StatusChip } from "./StatusChip";

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

// renders a single clickable note summary card in the index list
export function NoteCard({
  note,
  now,
  onSelect,
}: {
  note: NoteEntry;
  now?: Date;
  onSelect?: (slug: string) => void;
}) {
  const meta = NOTE_TARGET_META[note.target];
  const status = noteStatus(note.releaseTimestamp, now);
  const href = noteSearch(note.slug);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onSelect || !isPlainClick(event)) return;
    event.preventDefault();
    onSelect(note.slug);
  }

  return (
    <a className="note-card" href={href} onClick={handleClick}>
      <div className="note-card-top">
        <span className="note-target mono">{meta.monoLabel}</span>
        <StatusChip status={status} />
      </div>
      <h2 className="t-h3 note-card-title">{note.title}</h2>
      <p className="note-card-excerpt">{note.excerpt}</p>
      <div className="note-card-meta t-micro muted">
        <span className="mono num">{formatReleaseDateTime(note.releaseDate, note.target)}</span>
        <span className="mono num">{note.readingMinutes} min read</span>
        <Icon name="arrow-right" size={18} className="note-card-arrow" />
      </div>
    </a>
  );
}
