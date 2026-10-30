import { LEARN } from "../lib/navigation";
import type { Page } from "../lib/url";
import { Select } from "./Select";

export function LearnMenu({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return <div className="learn-menu">
    <Select label="Learn" triggerLabel="Learn" value={page}
      options={LEARN.map(([value, label]) => ({ value, label }))}
      onChange={(value) => {
        const chosen = LEARN.find(([p]) => p === value);
        if (chosen) onNavigate(chosen[0]);
      }} align="end" />
  </div>;
}
