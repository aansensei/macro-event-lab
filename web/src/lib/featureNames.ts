const NAMES: Record<string, string> = {
  LAG_1: "The last first published number", LAG_2: "The one before it", LAG_3: "Two before it",
  GDP_PREV: "Growth of the previous quarter", PAYEMS: "Payroll employment",
  INDPRO: "Industrial production", PCEC96: "Real consumer spending", RRSFS: "Real retail sales",
  HOUST: "Housing starts", UNRATE: "Unemployment rate",
};

export function featureName(id: string): string { return NAMES[id] ?? id; }
