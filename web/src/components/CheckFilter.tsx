import type { CheckSelection } from "../lib/statusStats";

export function CheckFilter({ selection, counts, onChange }: {
  selection: CheckSelection; counts: Record<CheckSelection, number>; onChange: (value: CheckSelection) => void;
}) {
  return <div className="check-filter" role="group" aria-label="Filter quality checks by status">
    {(["all", "pass", "warn", "fail"] as const).map((value) => <button type="button" key={value}
      aria-pressed={value === selection} onClick={() => onChange(value)}>
      {value.charAt(0).toUpperCase() + value.slice(1)} <span>{counts[value]}</span>
    </button>)}
  </div>;
}
