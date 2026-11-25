import { describe, expect, it } from "vitest";

import { parseLedgerSummary } from "./ledger";

const HASH = "a".repeat(64);
const valid = {
  schema_version: 1, rows: 16, first_recorded_at_utc: "2026-11-24T05:30:25Z",
  last_recorded_at_utc: "2026-11-25T01:31:12Z", last_as_of: "2026-11-25",
  head_hash: HASH, chain_ok: true, problems: 0,
};

describe("parseLedgerSummary", () => {
  it("accepts a verified ledger", () => {
    expect(parseLedgerSummary(valid)).toEqual(valid);
  });

  it("accepts an empty ledger with no dates and no hash", () => {
    const empty = { ...valid, rows: 0, first_recorded_at_utc: null, last_recorded_at_utc: null, last_as_of: null, head_hash: null };
    expect(parseLedgerSummary(empty).rows).toBe(0);
  });

  it("rejects a verdict that disagrees with the problem count", () => {
    expect(() => parseLedgerSummary({ ...valid, chain_ok: true, problems: 2 })).toThrow(/verdict/);
    expect(() => parseLedgerSummary({ ...valid, chain_ok: false, problems: 0 })).toThrow(/verdict/);
  });

  it("rejects a version it does not read, a malformed hash and a bad timestamp", () => {
    expect(() => parseLedgerSummary({ ...valid, schema_version: 2 })).toThrow(/version/);
    expect(() => parseLedgerSummary({ ...valid, head_hash: "xyz" })).toThrow(/hexadecimal/);
    expect(() => parseLedgerSummary({ ...valid, last_recorded_at_utc: "yesterday" })).toThrow(/timestamp/);
  });

  it("rejects rows that contradict the record times", () => {
    expect(() => parseLedgerSummary({ ...valid, rows: 0 })).toThrow(/row count/);
  });
});
