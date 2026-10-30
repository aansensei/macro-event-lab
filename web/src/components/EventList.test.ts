// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ManifestEvent } from "../data/types";
import { EventList } from "./EventList";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("hides surprise badges in both the sidebar and the opened mobile event menu", async () => {
  const event: ManifestEvent = { id: "hidden-badge", event_ticker: "FIXTURE", series: "KXCPI", title: "CPI fixture",
    unit: "%", close: "2025-01-15T13:30:00Z", release_date: "2025-01-15", first_print: 0.2,
    surprise: 0.1, surprise_sd: 2.4, file: "fixture.json", n_snapshots: 2, strikes: 3 };
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(EventList, {
      events: [event], dataThrough: "2025-01-15", selectedId: event.id, filter: "all",
      onSelect: vi.fn(), onFilter: vi.fn(), hideResults: true,
    })));
    expect(host.querySelector(".event-sidebar")?.textContent).toContain("Result hidden");
    expect(host.textContent).not.toContain("2.4 SD");
    const trigger = host.querySelectorAll<HTMLButtonElement>(".mobile-event-selectors .select-trigger")[1]!;
    await act(async () => trigger.click());
    expect(host.querySelector('[role="listbox"]')?.textContent).toContain("Result hidden");
    expect(host.querySelector('[role="listbox"]')?.textContent).not.toContain("2.4 SD");
  } finally { await act(async () => root.unmount()); host.remove(); }
});
