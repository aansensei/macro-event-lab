// @vitest-environment happy-dom
import { act, createElement, useEffect, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { App } from "./App";
import type { EventList } from "./components/EventList";
import type { Explorer } from "./components/Explorer";
import { loadManifest } from "./data/load";
import type { Manifest, ManifestEvent } from "./data/types";

vi.mock("./data/load", () => ({ loadManifest: vi.fn() }));
vi.mock("./pages/Overview", () => ({ Overview: () => createElement("h1", null, "Overview page") }));
vi.mock("./pages/About", () => ({ About: () => createElement("h1", null, "About page") }));
vi.mock("./pages/Compare", () => ({ Compare: () => createElement("h1", null, "Compare page") }));
vi.mock("./pages/Scorecard", () => ({ Scorecard: () => createElement("h1", null, "Scorecard page") }));
vi.mock("./pages/Revisions", () => ({ Revisions: () => createElement("h1", null, "Revisions page") }));
vi.mock("./pages/Models", () => ({ Models: () => createElement("h1", null, "Models page") }));
vi.mock("./pages/Method", () => ({ Method: () => createElement("h1", null, "Method page") }));
vi.mock("./pages/Glossary", () => ({ Glossary: () => createElement("h1", null, "Glossary page") }));
vi.mock("./components/EventList", () => ({
  EventList: ({ events, filter, onFilter, onSelect }: ComponentProps<typeof EventList>) =>
    createElement("aside", null,
      createElement("p", { "data-filter": true }, filter),
      createElement("button", { onClick: () => onFilter("jobs") }, "Filter jobs"),
      ...events.map((event) => createElement("button", { key: event.id, onClick: () => onSelect(event.id) }, event.id))),
}));
vi.mock("./components/Explorer", () => ({
  Explorer: ({ entry, initialHour, onHourChange, revealStage, onRevealChange }: ComponentProps<typeof Explorer>) => {
    const [hour, setHour] = useState(() => initialHour ?? 1);
    useEffect(() => onHourChange(hour), [hour, onHourChange]);
    return createElement("section", {
      "data-event": entry.id, "data-hour": String(initialHour), "data-latched-hour": String(hour), "data-reveal": revealStage,
    }, createElement("button", { onClick: () => setHour(24) }, "Show 24 hours"),
    createElement("button", { onClick: () => onRevealChange?.(1) }, "Reveal fixture"));
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

const old: ManifestEvent = {
  id: "old-release", event_ticker: "OLD", series: "KXCPI", title: "Old release", unit: "%",
  close: "2025-01-15T13:30:00Z", release_date: "2025-01-15", first_print: 0.2,
  surprise: 0.1, surprise_sd: 1, file: "old-release.json", n_snapshots: 24, strikes: 4,
};
const scored: ManifestEvent = { ...old, id: "scored-release", close: "2025-02-12T13:30:00Z" };
const upcoming: ManifestEvent = { ...old, id: "upcoming-release", first_print: null, surprise_sd: null };
const manifest: Manifest = { schema_version: 1, data_through: "2025-02-12", events: [old, scored, upcoming] };

beforeEach(() => {
  vi.mocked(loadManifest).mockReset().mockResolvedValue(manifest);
  window.history.replaceState(null, "", "/");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function render(search = "") {
  window.history.replaceState(null, "", `/${search}`);
  await act(async () => root.render(createElement(App)));
}

async function navigate(label: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Primary navigation"] button')]
    .find((item) => item.textContent === label)!;
  await act(async () => button.click());
}

it("opens Overview without requesting an Events manifest", async () => {
  await render();
  expect(host.querySelector("h1")?.textContent).toBe("Overview page");
  expect(loadManifest).not.toHaveBeenCalled();
});

it("shares reveal state, resets it for a new event and restores it from history", async () => {
  await render("?event=old-release&h=48&reveal=0");
  expect(host.querySelector("[data-event]")?.getAttribute("data-reveal")).toBe("0");
  const reveal = [...host.querySelectorAll<HTMLButtonElement>("[data-event] button")].find(b => b.textContent === "Reveal fixture")!;
  await act(async () => reveal.click());
  expect(window.location.search).toBe("?event=old-release&h=48&reveal=1");
  await act(async () => host.querySelector<HTMLButtonElement>("[data-event] button")!.click());
  expect(window.location.search).toBe("?event=old-release&h=24&reveal=1");
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>("aside button")].find(b => b.textContent === "scored-release")!.click());
  expect(host.querySelector("[data-event]")?.getAttribute("data-reveal")).toBe("0");
  await act(async () => {
    window.history.pushState(null, "", "/?event=old-release&h=7&reveal=1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(host.querySelector("[data-event]")?.getAttribute("data-reveal")).toBe("1");
  expect(host.querySelector("[data-event]")?.getAttribute("data-hour")).toBe("7");
});

it("restores the cursor for the same event even when its original requested hour is unchanged", async () => {
  await render("?event=old-release&h=48&reveal=0");
  await act(async () => host.querySelector<HTMLButtonElement>("[data-event] button")!.click());
  expect(host.querySelector("[data-event]")?.getAttribute("data-latched-hour")).toBe("24");
  await act(async () => {
    window.history.pushState(null, "", "/?event=old-release&h=48&reveal=0");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(host.querySelector("[data-event]")?.getAttribute("data-latched-hour")).toBe("48");
  expect(host.querySelector("[data-event]")?.getAttribute("data-reveal")).toBe("0");
});

it("keeps the Models route independent of market data", async () => {
  await render("?page=models");
  expect(host.querySelector("h1")?.textContent).toBe("Models page");
  expect(loadManifest).not.toHaveBeenCalled();
});

it("opens a legacy event link at its hour and updates its shareable timestamp", async () => {
  await render("?event=old-release&h=48");
  expect(host.querySelector("[data-event]")?.getAttribute("data-event")).toBe("old-release");
  expect(host.querySelector("[data-event]")?.getAttribute("data-hour")).toBe("48");
  await act(async () => host.querySelector<HTMLButtonElement>("[data-event] button")!.click());
  expect(window.location.search).toBe("?event=old-release&h=24");
});

it("defaults to the newest scored event and keeps the list newest first", async () => {
  await render("?page=events");
  expect(host.querySelector("[data-event]")?.getAttribute("data-event")).toBe("scored-release");
  expect([...host.querySelectorAll("aside button")].map((button) => button.textContent))
    .toEqual(["Filter jobs", "upcoming-release", "scored-release", "old-release"]);
});

it("retains the selection and filter across navigation without fetching again", async () => {
  await render("?page=events");
  await act(async () => host.querySelector<HTMLButtonElement>("aside button")!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>("aside button")]
    .find((button) => button.textContent === "old-release")!.click());
  await navigate("About");
  expect(host.querySelector("h1")?.textContent).toBe("About page");
  expect(window.location.search).toBe("?page=about");
  await navigate("Events");
  expect(host.querySelector("[data-event]")?.getAttribute("data-event")).toBe("old-release");
  expect(host.querySelector("[data-filter]")?.textContent).toBe("jobs");
  expect(host.querySelector("[data-event]")?.getAttribute("data-hour")).toBe("null");
  expect(loadManifest).toHaveBeenCalledTimes(1);
});

it("restores an event and hour from browser history and removes its listener on unmount", async () => {
  const remove = vi.spyOn(window, "removeEventListener");
  await render("?page=events");
  await act(async () => {
    window.history.pushState(null, "", "/?event=old-release&h=7");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(host.querySelector("[data-event]")?.getAttribute("data-event")).toBe("old-release");
  expect(host.querySelector("[data-event]")?.getAttribute("data-hour")).toBe("7");
  await act(async () => root.render(null));
  expect(remove.mock.calls.some(([type]) => type === "popstate")).toBe(true);
  remove.mockRestore();
});

it("shows a loading state before the manifest arrives", async () => {
  let resolve!: (value: Manifest) => void;
  vi.mocked(loadManifest).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  await render("?page=events");
  expect(host.querySelector("main")?.textContent).toBe("Loading events");
  await act(async () => resolve(manifest));
  expect(host.querySelector("[data-event]")).not.toBeNull();
});

it("provides the restored hour before remounting the event detail", async () => {
  await render("?event=old-release&h=48");
  await navigate("About");
  await act(async () => {
    window.history.pushState(null, "", "/?event=old-release&h=48");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(host.querySelector("[data-event]")?.getAttribute("data-latched-hour")).toBe("48");
  expect(window.location.search).toBe("?event=old-release&h=48");
});

it("shows the manifest error instead of mounting the explorer", async () => {
  vi.mocked(loadManifest).mockRejectedValueOnce(new Error("Manifest unavailable"));
  await render("?page=events");
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Manifest unavailable");
  expect(host.querySelector("[data-event]")).toBeNull();
});

it("falls back to a scored event when a linked identifier is not in the manifest", async () => {
  await render("?event=unknown-release&h=1");
  expect(host.querySelector("[data-event]")?.getAttribute("data-event")).toBe("scored-release");
});
