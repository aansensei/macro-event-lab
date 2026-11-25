import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { classifyLink, headingId, renderInline, renderMarkdown } from "./markdown";

function toHtml(markdown: string): string {
  return renderToStaticMarkup(createElement(Fragment, null, ...renderMarkdown(markdown)));
}

describe("markdown renderer", () => {
  it("renders headings from level 1 to level 4 with stable ids on level 2 headings", () => {
    const html = toHtml("# Title\n\n## 1. What is known\n\n### Detail\n\n#### Subdetail");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain(`<h2 id="${headingId("1. What is known")}" class="note-h2">1. What is known</h2>`);
    expect(html).toContain('<h3 class="note-h3">Detail</h3>');
    expect(html).toContain('<h4 class="note-h4">Subdetail</h4>');
  });

  it("renders paragraphs, bold, italic, inline code and line breaks inside paragraphs", () => {
    const html = toHtml("First **bold** and *italic* and `134.9`.\nSecond line here.");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<code class="note-code mono">134.9</code>');
    expect(html).toContain("<br/>Second line here.");
  });

  it("does not turn underscores inside identifiers into italics", () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, ...renderInline("2026-12-04_payrolls_november")));
    expect(html).toBe("2026-12-04_payrolls_november");
  });

  it("routes http, https and mailto links through ExternalLink and keeps internal links local", () => {
    const html = toHtml("See [BLS](https://www.bls.gov) and [mail](mailto:test@example.com) and [notes](?page=notes).");
    expect(html).toContain('href="https://www.bls.gov"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('href="mailto:test@example.com"');
    expect(html).toContain('<a href="?page=notes">notes</a>');
    expect(classifyLink("https://example.com")).toBe("external");
    expect(classifyLink("?page=notes")).toBe("internal");
    expect(classifyLink("javascript:alert(1)")).toBe("unsafe");
    expect(classifyLink("//other.example/page")).toBe("unsafe");
  });

  it("renders ordered and unordered lists with one level of nesting", () => {
    const md = [
      "- Outer one",
      "  - Nested bullet",
      "- Outer two",
      "",
      "1. First step",
      "   1. Nested step",
      "2. Second step",
    ].join("\n");
    const html = toHtml(md);
    expect(html).toContain('<ul class="note-ul">');
    expect(html).toContain('<ul class="note-ul note-nested"><li>Nested bullet</li></ul>');
    expect(html).toContain('<ol class="note-ol">');
    expect(html).toContain('<ol class="note-ol note-nested"><li>Nested step</li></ol>');
  });

  it("renders GitHub-style tables inside a scroll wrapper and horizontal rules", () => {
    const md = [
      "| Model | Forecast | Note |",
      "| :--- | ---: | :---: |",
      "| Autoregression | 99.7 | Low |",
      "| Ridge | 150.7 | Mid |",
      "",
      "---",
    ].join("\n");
    const html = toHtml(md);
    expect(html).toContain('<div class="note-table-wrap"><table class="note-table">');
    expect(html).toContain('text-align:right');
    expect(html).toContain('text-align:center');
    expect(html).toContain('<td style="text-align:right">99.7</td>');
    expect(html).toContain('<hr class="note-hr"/>');
  });

  it("neutralizes hostile javascript links and raw HTML tags as plain text", () => {
    const html = toHtml("Click [bad link](javascript:alert(1)) and <script>alert(1)</script>.");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("bad link");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders the real November 2026 payrolls note verbatim", () => {
    const raw = readFileSync(join(process.cwd(), "..", "notes", "2026-12-04_payrolls_november.md"), "utf8");
    const html = toHtml(raw);
    expect(html).toContain("November 2026 nonfarm payrolls (thousands of jobs, month over month change)");
    expect(html).toContain("1. What is known");
    expect(html).toContain("2. The mechanism");
    expect(html).toContain("3. My prediction");
    expect(html).toContain("4. What would change my mind");
    expect(html).toContain("5. After the release (written after publication)");
    expect(html).toContain("Autoregression: 99.7");
    expect(html).toContain("To be added in a dated section after the release.");
  });
});
