import type { NoteStatus } from "../lib/notesIndex";

const STATUS_LABEL: Record<NoteStatus, string> = {
  open: "Open, written before the release",
  released: "Released, result below",
};

// displays whether a note is still before its release moment or past it, using text and border cues
export function StatusChip({ status }: { status: NoteStatus }) {
  return (
    <span className={`note-status note-status-${status}`}>
      <span className="note-status-dot" aria-hidden="true" />
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}
