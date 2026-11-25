// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ArenaTarget } from "../data/arena";
import { arenaFixture } from "../data/arenaFixture";
import { loadLedgerTrack, type LedgerTrack } from "../data/ledgerTrack";
import { LiveTrackRecord } from "./LiveTrackRecord";

vi.mock("../data/ledgerTrack", () => ({ loadLedgerTrack: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const target: ArenaTarget = { id: "gdp", label: "GDP growth", unit: "percent", frequency: "quarterly" };
const empty: LedgerTrack = { schema_version: 1, ledger_rows: 2, scored: [], summary: [], late: 0,
  pending: [{ target: "gdp", reference_period: "2026-10-01", rows: 2 }] };

it("shows waiting counts without an empty table and hides failed or missing exports", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  vi.mocked(loadLedgerTrack).mockResolvedValue(empty);
  await act(async () => root.render(createElement(LiveTrackRecord, { target, contestants: [] })));
  expect(host.textContent).toContain("2 ledger forecasts are waiting across 1 release");
  expect(host.querySelector("table")).toBeNull();
  await act(async () => root.unmount());
  const next = createRoot(host);
  vi.mocked(loadLedgerTrack).mockRejectedValue(new Error("missing"));
  await act(async () => next.render(createElement(LiveTrackRecord, { target, contestants: [] })));
  expect(host.innerHTML).toBe("");
  await act(async () => next.unmount());
});

it("shows scores, paired baseline counts and collapsed audit records for the selected target", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  const record = { target: "gdp" as const, reference_period: "2026-07-01", model_id: "naive", forecast: 2,
    actual: 1, abs_error: 1, as_of: "2026-10-01", recorded_at_utc: "2026-10-01T00:00:00Z", release_date: "2026-10-20", sequence: 1 };
  vi.mocked(loadLedgerTrack).mockResolvedValue({ ...empty, late: 1, pending: [],
    scored: [record, { ...record, model_id: "fixture-b", forecast: 1, abs_error: 0, sequence: 2 }],
    summary: [{ target: "gdp", model_id: "naive", n: 1, mae: 1, rmse: 1, beat_naive: null },
      { target: "gdp", model_id: "fixture-b", n: 1, mae: 0, rmse: 0, beat_naive: 1 }] });
  await act(async () => root.render(createElement(LiveTrackRecord, { target, contestants: arenaFixture.contestants })));
  expect(host.textContent).toContain("1 of 1");
  expect(host.textContent).toContain("Rows recorded after the release date were not scored: 1");
  expect(host.querySelector(".track-records")?.hasAttribute("open")).toBe(false);
  expect(host.textContent).toContain("2026-10-01T00:00:00Z");
  expect([...host.querySelectorAll("thead th")].map((node) => node.textContent)).toEqual(["Model", "Releases scored", "MAE", "RMSE", "Beat naive"]);
  await act(async () => root.unmount());
});
