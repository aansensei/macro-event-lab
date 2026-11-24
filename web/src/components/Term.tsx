import type { ReactNode } from "react";

import { PUBLIC_EDITION } from "../lib/edition";
import { glossaryEntryFor } from "../lib/glossaryEdition";
import { pageSearch } from "../lib/url";

// a term with a dotted underline: hovering or focusing shows its short meaning, clicking opens the glossary
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const entry = glossaryEntryFor(id, PUBLIC_EDITION);
  if (!entry) return <>{children}</>;
  return (
    <a className="term" href={`${pageSearch("glossary")}#${id}`} data-hint={entry.short} aria-label={`${entry.term}: ${entry.short}`}>
      {children}
    </a>
  );
}
