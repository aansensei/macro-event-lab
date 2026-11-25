import { countValue, dateValue, fetchPublicJson, objectValue, textValue } from "./publicData";

export const LEDGER_NOT_BUILT = "The forecast ledger summary has not been built yet.";

export interface LedgerSummary {
  schema_version: 1;
  rows: number;
  first_recorded_at_utc: string | null;
  last_recorded_at_utc: string | null;
  last_as_of: string | null;
  head_hash: string | null;
  chain_ok: boolean;
  problems: number;
}

function optionalTimestamp(value: unknown, where: string): string | null {
  if (value === null) return null;
  const text = textValue(value, where);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(text) || !Number.isFinite(Date.parse(text))) {
    throw new Error(`${where}: expected a real UTC timestamp.`);
  }
  return text;
}

export function parseLedgerSummary(value: unknown): LedgerSummary {
  const root = objectValue(value, "Ledger summary");
  if (root.schema_version !== 1) throw new Error("Unsupported ledger summary version. This page reads version 1.");
  const rows = countValue(root.rows, "Ledger rows");
  const problems = countValue(root.problems, "Ledger problems");
  if (typeof root.chain_ok !== "boolean" || root.chain_ok !== (problems === 0)) {
    throw new Error("Ledger chain verdict does not match its problem count.");
  }
  const lastAsOf = root.last_as_of === null ? null : dateValue(root.last_as_of, "Ledger newest information date");
  let headHash: string | null = null;
  if (root.head_hash !== null) {
    headHash = textValue(root.head_hash, "Ledger head hash");
    if (!/^[0-9a-f]{64}$/.test(headHash)) throw new Error("Ledger head hash: expected 64 hexadecimal characters.");
  }
  const first = optionalTimestamp(root.first_recorded_at_utc, "First record time");
  const last = optionalTimestamp(root.last_recorded_at_utc, "Newest record time");
  if ((rows === 0) !== (last === null)) throw new Error("Ledger row count does not match its record times.");
  return {
    schema_version: 1, rows, first_recorded_at_utc: first, last_recorded_at_utc: last,
    last_as_of: lastAsOf, head_hash: headHash, chain_ok: root.chain_ok, problems,
  };
}

export async function loadLedgerSummary(fetchImpl: typeof fetch = fetch): Promise<LedgerSummary> {
  return parseLedgerSummary(await fetchPublicJson("ledger", LEDGER_NOT_BUILT, fetchImpl));
}
