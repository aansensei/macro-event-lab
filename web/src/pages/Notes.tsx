import { useState, type MouseEvent } from "react";

import { Icon } from "../components/Icon";
import { NoteArt } from "../components/NoteArt";
import { NoteCard } from "../components/NoteCard";
import { RailPage, type RailSection } from "../components/SectionRail";
import { StatusChip } from "../components/StatusChip";
import { renderMarkdown } from "../lib/markdown";
import { adjacentNotes, getNoteBySlug, NOTES, noteStatus, type NoteEntry } from "../lib/notesIndex";
import { formatReleaseDateTime, NOTE_TARGET_META, NOTE_TARGETS, type NoteTarget } from "../lib/notesMeta";
import { noteSearch, pageSearch } from "../lib/url";

type FilterValue = "all" | NoteTarget;

// the line under the illustration on every notes page
const ART_CAPTION = "Published once, then edited. The pencil never rests.";

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function shortRailLabel(label: string): string {
  return label.length > 34 ? `${label.slice(0, 32)}...` : label;
}

function NotesIndexView({
  notes,
  now,
  onSelectNote,
}: {
  notes: readonly NoteEntry[];
  now?: Date;
  onSelectNote?: (slug: string | null) => void;
}) {
  const [filter, setFilter] = useState<FilterValue>("all");

  const availableTargets = NOTE_TARGETS.filter((target) => notes.some((note) => note.target === target));
  const showFilters = notes.length > 1;
  const activeFilter: FilterValue = filter === "all" || availableTargets.includes(filter) ? filter : "all";
  const visibleNotes = activeFilter === "all" ? notes : notes.filter((note) => note.target === activeFilter);

  return (
    <div className="notes-page page-fade">
      <p className="section-kicker">Economist's notes</p>
      <h1 className="t-h1">Written before the number comes out</h1>
      <p className="about-lead">
        Each note states a prediction and its economic reasoning before a scheduled release and is never edited
        afterwards. Once the number is published, a dated section is added at the bottom to record what held and what
        did not.
      </p>
      <NoteArt caption={ART_CAPTION} />

      {showFilters && (
        <div className="notes-filters" role="group" aria-label="Filter notes by target">
          <button
            type="button"
            className="notes-filter-chip"
            aria-pressed={activeFilter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {availableTargets.map((target) => (
            <button
              key={target}
              type="button"
              className="notes-filter-chip"
              aria-pressed={activeFilter === target}
              onClick={() => setFilter(target)}
            >
              {NOTE_TARGET_META[target].label}
            </button>
          ))}
        </div>
      )}

      {visibleNotes.length === 0 ? (
        <p className="notes-empty muted">No notes have been published yet.</p>
      ) : (
        <ol className="notes-list">
          {visibleNotes.map((note) => (
            <li key={note.slug}>
              <NoteCard
                note={note}
                now={now}
                onSelect={onSelectNote ? (selectedSlug) => onSelectNote(selectedSlug) : undefined}
              />
            </li>
          ))}
        </ol>
      )}

      <p className="t-micro muted notes-cross-link">
        <a href={pageSearch("journal")}>Read the build journal</a>
      </p>
    </div>
  );
}

function NotePostView({
  slug,
  notes,
  now,
  onSelectNote,
}: {
  slug: string;
  notes: readonly NoteEntry[];
  now?: Date;
  onSelectNote?: (slug: string | null) => void;
}) {
  const note = getNoteBySlug(slug, notes);

  function goIndex(event: MouseEvent<HTMLAnchorElement>) {
    if (!onSelectNote || !isPlainClick(event)) return;
    event.preventDefault();
    onSelectNote(null);
  }

  function goNote(targetSlug: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onSelectNote || !isPlainClick(event)) return;
      event.preventDefault();
      onSelectNote(targetSlug);
    };
  }

  if (!note) {
    return (
      <div className="notes-page page-fade">
        <a className="notes-back" href={pageSearch("notes")} onClick={goIndex}>
          <span aria-hidden="true">&larr;</span>
          <span>All notes</span>
        </a>
        <h1 className="t-h1">Note not found</h1>
        <p className="notes-missing muted">No note matches that address.</p>
      </div>
    );
  }

  const meta = NOTE_TARGET_META[note.target];
  const status = noteStatus(note.releaseTimestamp, now);
  const { previous, next } = adjacentNotes(notes, note.slug);
  const railSections: RailSection[] = note.sections.map((section) => ({
    id: section.id,
    label: shortRailLabel(section.label),
  }));

  const article = (
    <article className="note-post page-fade">
      <a className="notes-back" href={pageSearch("notes")} onClick={goIndex}>
        <span aria-hidden="true">&larr;</span>
        <span>All notes</span>
      </a>

      <header className="note-post-head">
        <p className="note-target mono">{meta.monoLabel}</p>
        <h1 className="t-h1" id="note-top">{note.title}</h1>
        <div className="note-post-meta">
          <span className="mono num muted">{formatReleaseDateTime(note.releaseDate, note.target)}</span>
          <span className="mono num muted">{note.readingMinutes} min read</span>
          <StatusChip status={status} />
        </div>
      </header>

      <NoteArt target={note.target} caption={ART_CAPTION} />

      <div className="note-body">{renderMarkdown(note.body)}</div>

      <aside className="note-about" aria-labelledby="note-about-title">
        <h2 className="t-h3" id="note-about-title">About this note</h2>
        <ul className="note-about-lines">
          <li>This note was written before the release.</li>
          <li>It is never edited after the release.</li>
          <li>A correction is a new dated section at the bottom.</li>
        </ul>
        <div className="note-about-status">
          <StatusChip status={status} />
        </div>
      </aside>

      {(previous || next) && (
        <nav className="note-pager" aria-label="Neighbouring notes">
          {previous && (
            <a className="note-pager-link note-pager-prev" href={noteSearch(previous.slug)} onClick={goNote(previous.slug)}>
              <span className="mono muted">Previous note</span>
              <span className="note-pager-title">{previous.title}</span>
              <span className="t-micro mono num muted">{previous.releaseDate}</span>
            </a>
          )}
          {next && (
            <a className="note-pager-link note-pager-next" href={noteSearch(next.slug)} onClick={goNote(next.slug)}>
              <span className="mono muted">Next note</span>
              <span className="note-pager-title">{next.title}</span>
              <span className="t-micro mono num muted">{next.releaseDate}</span>
              <Icon name="arrow-right" size={16} className="note-pager-arrow" />
            </a>
          )}
        </nav>
      )}
    </article>
  );

  return railSections.length > 0 ? <RailPage sections={railSections}>{article}</RailPage> : article;
}

// blog-style notes page with an index view and a single-note reading view
export function Notes({
  slug = null,
  notes = NOTES,
  now,
  onSelectNote,
}: {
  slug?: string | null;
  notes?: readonly NoteEntry[];
  now?: Date;
  onSelectNote?: (slug: string | null) => void;
}) {
  if (slug) return <NotePostView slug={slug} notes={notes} now={now} onSelectNote={onSelectNote} />;
  return <NotesIndexView notes={notes} now={now} onSelectNote={onSelectNote} />;
}
