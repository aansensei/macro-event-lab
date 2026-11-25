export type NoteTarget = "payrolls" | "cpi" | "gdp";

export interface NoteTargetMeta {
  target: NoteTarget;
  label: string;
  monoLabel: string;
  releaseTimeUtc: string;
}

// release times of day in UTC for each target; update this table if a schedule changes
export const NOTE_TARGET_META: Record<NoteTarget, NoteTargetMeta> = {
  payrolls: { target: "payrolls", label: "Payrolls", monoLabel: "PAYROLLS", releaseTimeUtc: "13:30" },
  cpi: { target: "cpi", label: "Inflation", monoLabel: "INFLATION", releaseTimeUtc: "13:30" },
  gdp: { target: "gdp", label: "GDP", monoLabel: "GDP", releaseTimeUtc: "13:30" },
};

export const NOTE_TARGETS: readonly NoteTarget[] = ["payrolls", "cpi", "gdp"];

export function isNoteTarget(value: string): value is NoteTarget {
  return value === "payrolls" || value === "cpi" || value === "gdp";
}

// combines a YYYY-MM-DD release date with the target's UTC release time
export function releaseTimestampUtc(releaseDate: string, target: NoteTarget): string {
  return `${releaseDate}T${NOTE_TARGET_META[target].releaseTimeUtc}:00Z`;
}

// formats a release date and time for display on cards and note headers
export function formatReleaseDateTime(releaseDate: string, target: NoteTarget): string {
  return `Release ${releaseDate}, ${NOTE_TARGET_META[target].releaseTimeUtc} UTC`;
}
