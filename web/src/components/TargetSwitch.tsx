import type { ArenaTarget, TargetId } from "../data/arena";

export function TargetSwitch({ targets, selected, onChange }: {
  targets: ArenaTarget[]; selected: TargetId; onChange: (target: TargetId) => void;
}) {
  return <div className="arena-targets" role="radiogroup" aria-label="Choose an economic target">
    {targets.map((target, index) => <button type="button" role="radio" key={target.id}
      aria-checked={target.id === selected} tabIndex={target.id === selected ? 0 : -1}
      onClick={() => onChange(target.id)} onKeyDown={(event) => {
        let next: number;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % targets.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + targets.length) % targets.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = targets.length - 1;
        else return;
        event.preventDefault();
        const choice = targets[next];
        if (choice) onChange(choice.id);
        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
      }}>
      <strong>{target.label}</strong><span>{target.frequency === "quarterly" ? "Quarterly" : "Monthly"}</span><small>{target.unit}</small>
    </button>)}
  </div>;
}
