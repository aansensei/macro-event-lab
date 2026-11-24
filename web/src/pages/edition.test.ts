// @vitest-environment happy-dom
import type { ComponentType } from "react";
import { afterEach, expect, it, vi } from "vitest";

const cases: [string, () => Promise<ComponentType>, boolean][] = [
  ["About", async () => (await import("./About")).About, true],
  ["Method", async () => (await import("./Method")).Method, true],
  ["Glossary", async () => (await import("./Glossary")).Glossary, false],
  ["Models", async () => (await import("./Models")).Models, false],
  ["Revisions", async () => (await import("./Revisions")).Revisions, false],
  ["PublicHome", async () => (await import("./PublicHome")).PublicHome, false],
  ["Status", async () => (await import("./Status")).Status, false],
  ["Data", async () => (await import("./Data")).Data, false],
  ["Briefing", async () => (await import("./Briefing")).Briefing, false],
  ["Play", async () => (await import("./Play")).Play, false],
  ["Arena", async () => (await import("./Arena")).Arena, false],
  ["DataLineage", async () => (await import("../components/DataLineage")).DataLineage, true],
];

afterEach(() => { vi.unstubAllEnvs(); });

for (const edition of ["public", "research"]) {
  it.each(cases)(`renders %s with ${edition} sources`, async (_, load, hasResearchSource) => {
    vi.stubEnv("VITE_EDITION", edition);
    vi.resetModules();
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const Page = await load();
    const markup = renderToStaticMarkup(createElement(Page));
    if (edition === "public") expect(markup).not.toMatch(/kalshi|KX(CPI|GDP|PAYROLLS|FED)/i);
    else if (hasResearchSource) expect(markup).toMatch(/kalshi/i);
  });

  it(`renders the footer and shell for the ${edition} edition`, async () => {
    vi.stubEnv("VITE_EDITION", edition);
    vi.resetModules();
    window.history.replaceState(null, "", "/?page=about");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { App } = await import("../App");
    const markup = renderToStaticMarkup(createElement(App));
    expect(markup).toContain("Educational research only");
    expect(markup).toContain("Cao Thien An Nguyen");
    if (edition === "public") {
      expect(markup).not.toMatch(/kalshi|KX(CPI|GDP|PAYROLLS|FED)/i);
      expect(markup).not.toContain("https://kalshi.com");
    } else expect(markup).toContain("https://kalshi.com");
  });
}

it("keeps a research route unavailable in the public shell", async () => {
  vi.stubEnv("VITE_EDITION", "public");
  vi.resetModules();
  window.history.replaceState(null, "", "/?page=events");
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { App } = await import("../App");
  const markup = renderToStaticMarkup(createElement(App));
  expect(markup).toContain("Not published yet");
  expect(markup).not.toMatch(/kalshi|KX(CPI|GDP|PAYROLLS|FED)/i);
});
