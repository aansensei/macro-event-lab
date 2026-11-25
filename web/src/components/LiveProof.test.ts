import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { LEDGER_FILE_URL } from "../lib/liveProof";
import { LiveProof } from "./LiveProof";

const NOW = "2026-11-24T20:00:00Z";
const ledger = {
  schema_version: 1 as const, rows: 16, first_recorded_at_utc: "2026-11-24T05:30:25Z",
  last_recorded_at_utc: "2026-11-25T01:31:12Z", last_as_of: "2026-11-25",
  head_hash: "a".repeat(64), chain_ok: true, problems: 0,
};
const status = { generated_at: "2026-11-24T05:30:25Z", information_date: "2026-11-23", sources: [{ is_fresh: true }] };

it("renders a heading and one link per proof item, the ledger link opening in a new tab", () => {
  const html = renderToStaticMarkup(createElement(LiveProof, { ledger, status, releases: [], nowIso: NOW }));
  expect(html).toContain("Live proof");
  expect(html.match(/<a /g)).toHaveLength(2);
  expect(html).toContain(`href="${LEDGER_FILE_URL}"`);
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain('href="?page=status"');
  expect(html).toContain("16 forecasts");
});

it("renders nothing when no source is available", () => {
  const html = renderToStaticMarkup(createElement(LiveProof, { ledger: null, status: null, releases: [], nowIso: NOW }));
  expect(html).toBe("");
});
