import { describe, expect, it } from "vitest";

import type { BriefingRelease } from "../data/briefing";
import type { LedgerSummary } from "../data/ledger";
import { LEDGER_FILE_URL, liveProofItems } from "./liveProof";

const NOW = "2026-11-24T20:00:00Z";
const ledger: LedgerSummary = {
  schema_version: 1, rows: 16, first_recorded_at_utc: "2026-11-24T05:30:25Z",
  last_recorded_at_utc: "2026-11-25T01:31:12Z", last_as_of: "2026-11-25",
  head_hash: "a".repeat(64), chain_ok: true, problems: 0,
};
const status = { generated_at: "2026-11-24T05:30:25Z", information_date: "2026-11-23", sources: [{ is_fresh: true }] };

function release(target: BriefingRelease["target"], date: string | null, period = "2026-11-01"): BriefingRelease {
  return { target, label: target === "payrolls" ? "Payrolls" : "CPI", unit: "x", period, release_date: date, release_ts_utc: null, forecasts: [], last_first_print: null };
}

describe("liveProofItems", () => {
  it("builds the three items in a fixed order with their evidence links", () => {
    const items = liveProofItems(ledger, status, [release("payrolls", "2026-12-04")], NOW);
    expect(items.map((item) => item.id)).toEqual(["ledger", "refresh", "release"]);
    expect(items[0]).toMatchObject({ value: "16 forecasts", href: LEDGER_FILE_URL, external: true, ok: true });
    expect(items[1]).toMatchObject({ value: "2026-11-24 05:30 UTC", href: "?page=status", external: false, ok: true });
    expect(items[2]).toMatchObject({ value: "Payrolls, November 2026", href: "?page=briefing" });
    expect(items[2]!.detail).toBe("In 10 days, Friday, December 4, 2026.");
  });

  it("picks the earliest release that is not in the past and skips undated ones", () => {
    const items = liveProofItems(null, null, [
      release("cpi", "2026-12-10"), release("payrolls", null), release("cpi", "2026-11-01"), release("payrolls", "2026-12-04"),
    ], NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.value).toBe("Payrolls, November 2026");
  });

  it("says today and tomorrow instead of a day count", () => {
    expect(liveProofItems(null, null, [release("cpi", "2026-11-24")], NOW)[0]!.detail).toMatch(/^Today, /);
    expect(liveProofItems(null, null, [release("cpi", "2026-11-25")], NOW)[0]!.detail).toMatch(/^Tomorrow, /);
  });

  it("drops an item whose source is missing", () => {
    expect(liveProofItems(null, null, [], NOW)).toEqual([]);
    expect(liveProofItems(ledger, null, [], NOW).map((item) => item.id)).toEqual(["ledger"]);
  });

  it("reports a failed chain check and a late refresh as not ok", () => {
    const broken = { ...ledger, chain_ok: false, problems: 1 };
    const items = liveProofItems(broken, { ...status, generated_at: "2026-11-20T05:30:25Z" }, [], NOW);
    expect(items[0]).toMatchObject({ ok: false });
    expect(items[0]!.detail).toMatch(/failed/);
    expect(items[1]).toMatchObject({ ok: false });
    expect(items[1]!.detail).toMatch(/overdue/);
  });

  it("uses the singular for one forecast and says so for an empty ledger", () => {
    expect(liveProofItems({ ...ledger, rows: 1 }, null, [], NOW)[0]!.value).toBe("1 forecast");
    const empty = { ...ledger, rows: 0, last_recorded_at_utc: null, first_recorded_at_utc: null, last_as_of: null, head_hash: null };
    expect(liveProofItems(empty, null, [], NOW)[0]!.detail).toBe("Nothing has been recorded yet.");
  });
});
