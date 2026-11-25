// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => {
  vi.unstubAllEnvs();
});

it("reports whether LearnMenu is shown from the edition flag", async () => {
  const { showsLearnMenu } = await import("./Header");
  expect(showsLearnMenu(true)).toBe(false);
  expect(showsLearnMenu(false)).toBe(true);
});

it("renders without LearnMenu in the public edition", async () => {
  vi.stubEnv("VITE_EDITION", "public");
  vi.resetModules();
  const { Header } = await import("./Header");
  const html = renderToStaticMarkup(createElement(Header, { page: "overview", onNavigate: vi.fn() }));
  expect(html).toContain("Home");
  expect(html).toContain("GDP nowcast");
  expect(html).not.toContain('class="learn-menu"');
  expect(html).not.toContain(">Learn<");
});

it("keeps LearnMenu in the research edition", async () => {
  vi.stubEnv("VITE_EDITION", "research");
  vi.resetModules();
  const { Header } = await import("./Header");
  const html = renderToStaticMarkup(createElement(Header, { page: "overview", onNavigate: vi.fn() }));
  expect(html).toContain('class="learn-menu"');
  expect(html).toContain(">Learn<");
});
