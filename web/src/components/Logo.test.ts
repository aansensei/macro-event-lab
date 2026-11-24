import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "./Logo";

describe("Logo", () => {
  it("draws the lockup with the outlined wordmark and a theme-driven accent", () => {
    const html = renderToStaticMarkup(createElement(Logo));
    expect(html).toContain('viewBox="0 0 313 64"');
    expect(html).toContain('aria-label="Macro Event Lab"');
    expect(html).toContain("var(--accent)");
    expect(html).toContain("var(--text)");
    expect(html).not.toContain("<text");
  });

  it("draws the mark alone on a square canvas without the wordmark", () => {
    const html = renderToStaticMarkup(createElement(Logo, { variant: "mark" }));
    expect(html).toContain('viewBox="0 0 64 64"');
    expect(html).not.toContain("var(--text)");
  });

  it("uses no hard coded colors so both themes stay readable", () => {
    expect(renderToStaticMarkup(createElement(Logo))).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});
