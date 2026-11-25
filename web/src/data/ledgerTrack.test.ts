import { expect, it, vi } from "vitest";
import { loadLedgerTrack, parseLedgerTrack } from "./ledgerTrack";

export const trackFixture = {
  schema_version: 1, scored: [{ target: "gdp", reference_period: "2026-07-01", model_id: "naive",
    forecast: 2, actual: 1, abs_error: 1, as_of: "2026-10-01", recorded_at_utc: "2026-10-01T00:00:00Z",
    release_date: "2026-10-20", sequence: 1 }],
  summary: [{ target: "gdp", model_id: "naive", n: 1, mae: 1, rmse: 1, beat_naive: null }],
  pending: [], late: 0, ledger_rows: 1,
};

it("parses scored and pending records and rejects invalid types and late records", () => {
  expect(parseLedgerTrack(trackFixture).summary[0]?.mae).toBe(1);
  expect(parseLedgerTrack({ ...trackFixture, scored: [], summary: [], pending: [{ target: "gdp", reference_period: "2026-10-01", rows: 1 }] }).pending).toHaveLength(1);
  expect(() => parseLedgerTrack({ ...trackFixture, schema_version: 2 })).toThrow(/version/);
  expect(() => parseLedgerTrack({ ...trackFixture, ledger_rows: 2 })).toThrow(/counts/);
  expect(() => parseLedgerTrack({ ...trackFixture, scored: [{ ...trackFixture.scored[0], forecast: "2" }] })).toThrow(/number/);
  expect(() => parseLedgerTrack({ ...trackFixture, scored: [{ ...trackFixture.scored[0], recorded_at_utc: "2026-10-20T00:00:00Z" }] })).toThrow(/late/);
});

it("loads valid JSON and reports missing or unreachable exports", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(trackFixture)));
  expect((await loadLedgerTrack(fetcher)).ledger_rows).toBe(1);
  fetcher.mockResolvedValue(new Response("", { status: 404 }));
  await expect(loadLedgerTrack(fetcher)).rejects.toThrow(/not been built/);
  fetcher.mockRejectedValue(new Error("offline"));
  await expect(loadLedgerTrack(fetcher)).rejects.toThrow(/could not be reached/);
});
