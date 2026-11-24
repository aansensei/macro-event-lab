import type { ArenaWindow } from "../data/arena";

export function WindowToggle({ value, onChange }: { value: ArenaWindow; onChange: (value: ArenaWindow) => void }) {
  return <div className="check-filter arena-window" role="group" aria-label="Evaluation window">
    {(["all", "clean"] as const).map((window) => <button type="button" key={window}
      aria-pressed={window === value} onClick={() => onChange(window)}>{window === "all" ? "All periods" : "Clean periods"}</button>)}
  </div>;
}
