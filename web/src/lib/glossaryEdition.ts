import { GLOSSARY_GROUPS, glossaryEntry, type GlossaryEntry } from "./glossary";

const PUBLIC_IDS = new Set([
  "cpi", "m-m", "payrolls", "gdp", "first-print", "revision", "alfred", "point-in-time", "pp",
  ...GLOSSARY_GROUPS.filter((group) => group.id === "gl-arena").flatMap((group) => group.ids),
]);
const PUBLIC_EXPLANATIONS: Record<string, string> = {
  "first-print": "The earliest published value for an economic period. Forecasts are compared with this value, before later revisions arrive.",
  revision: "A later published change to an economic number. Revisions are shown separately from the first print so later information cannot enter an earlier forecast.",
  "point-in-time": "Using only information already published at the chosen cutoff. Later observations and revisions are excluded from an earlier forecast.",
};

export function glossaryGroupsFor(isPublic: boolean): typeof GLOSSARY_GROUPS {
  if (!isPublic) return GLOSSARY_GROUPS;
  return GLOSSARY_GROUPS.map((group) => ({ ...group, ids: group.ids.filter((id) => PUBLIC_IDS.has(id)) }))
    .filter((group) => group.ids.length > 0);
}

export function glossaryEntryFor(id: string, isPublic: boolean): GlossaryEntry | undefined {
  if (isPublic && !PUBLIC_IDS.has(id)) return undefined;
  const entry = glossaryEntry(id);
  const explanation = isPublic ? PUBLIC_EXPLANATIONS[id] : undefined;
  return entry && explanation ? { ...entry, long: explanation } : entry;
}
