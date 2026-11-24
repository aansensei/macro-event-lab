// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { loadBriefing, type Briefing as BriefingData } from "../data/briefing";
import { Briefing } from "./Briefing";

vi.mock("../data/briefing", () => ({
  BRIEFING_NOT_BUILT: "The release briefing has not been built yet.",
  loadBriefing: vi.fn(),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let host: HTMLDivElement;
let root: Root;

const SAMPLE_BRIEFING: BriefingData = {
  schema_version: 1,
  information_date: "2026-11-24",
  releases: [
    {
      target: "payrolls",
      label: "Payrolls",
      unit: "thousands of jobs",
      period: "2026-11-01",
      release_date: "2026-12-04",
      release_ts_utc: "2026-12-04T13:30:00Z",
      forecasts: [
        { id: "naive", label: "Naive", kind: "baseline", value: 165.0 },
        { id: "ar", label: "Autoregression", kind: "classical", value: 99.7 },
      ],
      last_first_print: 165.0,
    },
    {
      target: "gdp",
      label: "GDP growth",
      unit: "annualized percent q/q",
      period: "2026-10-01",
      release_date: null,
      release_ts_utc: null,
      forecasts: [
        { id: "spf", label: "Professional forecasters", kind: "human", value: 2.3 },
      ],
      last_first_print: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadBriefing).mockResolvedValue(structuredClone(SAMPLE_BRIEFING));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("renders the formatted date, forecast label, and calendar/feed links", async () => {
  await act(async () => root.render(createElement(Briefing)));
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.textContent).toContain("Friday, December 4, 2026");
  expect(host.textContent).toContain("In 10 days");
  expect(host.textContent).toContain("Autoregression");
  expect(host.textContent).toContain("Survey of Professional Forecasters");
  const calendarLink = host.querySelector<HTMLAnchorElement>('a[href="data/calendar.ics"]');
  const feedLink = host.querySelector<HTMLAnchorElement>('a[href="data/feed.xml"]');
  expect(calendarLink?.textContent).toContain("Add to calendar");
  expect(feedLink?.textContent).toContain("News feed");
});

it("renders a clear message when there are no releases", async () => {
  vi.mocked(loadBriefing).mockResolvedValueOnce({
    schema_version: 1,
    information_date: "2026-11-24",
    releases: [],
  });
  await act(async () => root.render(createElement(Briefing)));
  expect(host.textContent).toContain("No upcoming releases are listed in the current briefing.");
});
