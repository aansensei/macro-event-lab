// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadStatus } from "../data/status";
import { statusFixture } from "../data/statusFixture";
import { RefreshLine } from "./RefreshLine";

vi.mock("../data/status", () => ({ loadStatus: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("renders the refresh text, current state word, icon and build log link when present", async () => {
  vi.mocked(loadStatus).mockResolvedValueOnce({
    ...statusFixture,
    run_url: "https://github.com/aansensei/macro-event-lab/actions/runs/55",
  });
  await act(async () => root.render(createElement(RefreshLine, { nowIso: "2026-11-20T18:00:00Z" })));
  expect(host.textContent).toContain(
    "Data refreshed 2026-11-20 14:30 UTC. Newest source data: 2026-11-20. Next rebuild about 14:30 UTC.",
  );
  expect(host.textContent).toContain("current");
  expect(host.querySelector(".refresh-state svg")).not.toBeNull();
  const link = host.querySelector<HTMLAnchorElement>("a.refresh-line-link");
  expect(link?.textContent).toContain("Build log");
  expect(link?.getAttribute("href")).toBe("https://github.com/aansensei/macro-event-lab/actions/runs/55");
});

it("renders late state without a build log link when run_url is missing", async () => {
  vi.mocked(loadStatus).mockResolvedValueOnce(structuredClone(statusFixture));
  await act(async () => root.render(createElement(RefreshLine, { nowIso: "2026-11-22T00:00:00Z" })));
  expect(host.textContent).toContain(
    "Data refreshed 2026-11-20 14:30 UTC. Newest source data: 2026-11-20. Next rebuild about 14:30 UTC.",
  );
  expect(host.textContent).toContain("late");
  expect(host.querySelector(".refresh-state svg")).not.toBeNull();
  expect(host.querySelector("a")).toBeNull();
});

it("renders the missing text when status cannot be loaded", async () => {
  vi.mocked(loadStatus).mockRejectedValueOnce(new Error("unavailable"));
  await act(async () => root.render(createElement(RefreshLine)));
  expect(host.textContent).toBe("Refresh time unavailable");
  expect(host.querySelector("a")).toBeNull();
});
