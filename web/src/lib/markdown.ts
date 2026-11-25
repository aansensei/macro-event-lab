import { createElement, Fragment, type ReactNode } from "react";

import { ExternalLink } from "../components/ExternalLink";

type Alignment = "left" | "center" | "right";

interface ListItem {
  text: string;
  nested: { ordered: boolean; items: string[] } | null;
}

// builds a stable section anchor id from heading text
export function headingId(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `note-section-${slug || "section"}`;
}

// checks whether a link address is safe to render as an anchor
export function classifyLink(href: string): "external" | "internal" | "unsafe" {
  const trimmed = href.trim();
  if (!trimmed) return "unsafe";
  if (/^(https?:|mailto:)/i.test(trimmed)) return "external";
  // an address that starts with two slashes names another site, so it is never treated as a link inside this one
  if (trimmed.startsWith("//")) return "unsafe";
  if (/^([/?#]|\.\.?\/)/.test(trimmed)) return "internal";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return "unsafe";
  return "internal";
}

function isHorizontalRule(line: string): boolean {
  return /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function parseHeading(line: string): { level: 1 | 2 | 3 | 4; text: string } | null {
  const match = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
  if (!match) return null;
  const hashes = match[1] ?? "#";
  const text = (match[2] ?? "").trim();
  return { level: hashes.length as 1 | 2 | 3 | 4, text };
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseTableSeparator(line: string): Alignment[] | null {
  if (!line.includes("|")) return null;
  const cells = splitTableRow(line);
  if (cells.length === 0) return null;
  const alignments: Alignment[] = [];
  for (const cell of cells) {
    if (!/^:?-{3,}:?$/.test(cell)) return null;
    if (cell.startsWith(":") && cell.endsWith(":")) alignments.push("center");
    else if (cell.endsWith(":")) alignments.push("right");
    else alignments.push("left");
  }
  return alignments;
}

function matchListLine(line: string): { indent: number; ordered: boolean; text: string } | null {
  const match = /^([ \t]*)([-*]|\d+\.)\s+(.*)$/.exec(line);
  if (!match) return null;
  const rawIndent = match[1] ?? "";
  const indent = rawIndent.replace(/\t/g, "  ").length;
  const marker = match[2] ?? "-";
  return { indent, ordered: /\d+\./.test(marker), text: match[3] ?? "" };
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (line.trim() === "") return true;
  if (parseHeading(line)) return true;
  if (isHorizontalRule(line)) return true;
  if (matchListLine(line)) return true;
  const next = lines[index + 1];
  if (line.includes("|") && next !== undefined && parseTableSeparator(next) !== null) return true;
  return false;
}

// parses inline bold, italic, code and links into React nodes without executing raw HTML
export function renderInline(text: string, keyPrefix = "in"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  const nextKey = () => `${keyPrefix}-${tokenIndex++}`;

  while (cursor < text.length) {
    const ch = text[cursor];

    if (ch === "`") {
      const end = text.indexOf("`", cursor + 1);
      if (end > cursor + 1) {
        nodes.push(createElement("code", { key: nextKey(), className: "note-code mono" }, text.slice(cursor + 1, end)));
        cursor = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const closeBracket = text.indexOf("]", cursor + 1);
      if (closeBracket > cursor + 1 && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket + 1) {
          const label = text.slice(cursor + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen).trim();
          const kind = classifyLink(href);
          if (kind === "external") {
            nodes.push(createElement(ExternalLink, { key: nextKey(), href, children: renderInline(label, nextKey()) }));
          } else if (kind === "internal") {
            nodes.push(createElement("a", { key: nextKey(), href }, ...renderInline(label, nextKey())));
          } else {
            nodes.push(label);
          }
          cursor = closeParen + 1;
          continue;
        }
      }
    }

    if (ch === "*" && text[cursor + 1] === "*") {
      const end = text.indexOf("**", cursor + 2);
      if (end > cursor + 2) {
        nodes.push(createElement("strong", { key: nextKey() }, ...renderInline(text.slice(cursor + 2, end), nextKey())));
        cursor = end + 2;
        continue;
      }
    }

    if (ch === "_" && text[cursor + 1] === "_") {
      const prev = cursor > 0 ? text[cursor - 1] ?? "" : "";
      const end = text.indexOf("__", cursor + 2);
      const after = end > -1 ? text[end + 2] ?? "" : "";
      if (end > cursor + 2 && !/[a-z0-9]/i.test(prev) && !/[a-z0-9]/i.test(after)) {
        nodes.push(createElement("strong", { key: nextKey() }, ...renderInline(text.slice(cursor + 2, end), nextKey())));
        cursor = end + 2;
        continue;
      }
    }

    if (ch === "*" && text[cursor + 1] !== "*" && text[cursor + 1] !== " ") {
      const end = text.indexOf("*", cursor + 1);
      if (end > cursor + 1 && text[end - 1] !== " ") {
        nodes.push(createElement("em", { key: nextKey() }, ...renderInline(text.slice(cursor + 1, end), nextKey())));
        cursor = end + 1;
        continue;
      }
    }

    if (ch === "_" && text[cursor + 1] !== "_" && text[cursor + 1] !== " ") {
      const prev = cursor > 0 ? text[cursor - 1] ?? "" : "";
      const end = text.indexOf("_", cursor + 1);
      const after = end > -1 ? text[end + 1] ?? "" : "";
      if (end > cursor + 1 && text[end - 1] !== " " && !/[a-z0-9]/i.test(prev) && !/[a-z0-9]/i.test(after)) {
        nodes.push(createElement("em", { key: nextKey() }, ...renderInline(text.slice(cursor + 1, end), nextKey())));
        cursor = end + 1;
        continue;
      }
    }

    let nextSpecial = cursor + 1;
    while (nextSpecial < text.length && !"`[*_".includes(text[nextSpecial] ?? "")) {
      nextSpecial++;
    }
    nodes.push(text.slice(cursor, nextSpecial));
    cursor = nextSpecial;
  }

  return nodes;
}

function renderParagraphLines(lines: string[], keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const cleaned = raw.replace(/\\$/, "").replace(/ {2,}$/, "");
    out.push(...renderInline(cleaned, `${keyPrefix}-l${i}`));
    if (i < lines.length - 1) out.push(createElement("br", { key: `${keyPrefix}-br${i}` }));
  }
  return out;
}

// renders a restricted Markdown subset to React nodes with no HTML injection
export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockIndex = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trim() === "") {
      i++;
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      const tag = `h${heading.level}` as "h1" | "h2" | "h3" | "h4";
      const props: { key: string; id?: string; className?: string } = { key: `b-${blockIndex++}` };
      if (heading.level === 2) {
        props.id = headingId(heading.text);
        props.className = "note-h2";
      } else if (heading.level === 3) {
        props.className = "note-h3";
      } else if (heading.level === 4) {
        props.className = "note-h4";
      }
      blocks.push(createElement(tag, props, ...renderInline(heading.text, `h-${blockIndex}`)));
      i++;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push(createElement("hr", { key: `b-${blockIndex++}`, className: "note-hr" }));
      i++;
      continue;
    }

    const nextLine = lines[i + 1];
    if (line.includes("|") && nextLine !== undefined) {
      const alignments = parseTableSeparator(nextLine);
      if (alignments) {
        const headers = splitTableRow(line);
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length) {
          const rowLine = lines[i] ?? "";
          if (rowLine.trim() === "" || !rowLine.includes("|")) break;
          rows.push(splitTableRow(rowLine));
          i++;
        }
        const key = `b-${blockIndex++}`;
        const headerRow = createElement(
          "tr",
          null,
          ...headers.map((cell, c) =>
            createElement(
              "th",
              { key: `${key}-th-${c}`, scope: "col", style: alignments[c] ? { textAlign: alignments[c] } : undefined },
              ...renderInline(cell, `${key}-th-${c}`),
            ),
          ),
        );
        const bodyRows = rows.map((row, r) =>
          createElement(
            "tr",
            { key: `${key}-tr-${r}` },
            ...headers.map((_, c) =>
              createElement(
                "td",
                { key: `${key}-td-${r}-${c}`, style: alignments[c] ? { textAlign: alignments[c] } : undefined },
                ...renderInline(row[c] ?? "", `${key}-td-${r}-${c}`),
              ),
            ),
          ),
        );
        blocks.push(
          createElement(
            "div",
            { key, className: "note-table-wrap" },
            createElement(
              "table",
              { className: "note-table" },
              createElement("thead", null, headerRow),
              createElement("tbody", null, ...bodyRows),
            ),
          ),
        );
        continue;
      }
    }

    const listStart = matchListLine(line);
    if (listStart) {
      const baseIndent = listStart.indent;
      const ordered = listStart.ordered;
      const items: ListItem[] = [];
      while (i < lines.length) {
        const parsed = matchListLine(lines[i] ?? "");
        if (!parsed) break;
        if (parsed.indent > baseIndent && items.length > 0) {
          const parent = items[items.length - 1]!;
          if (!parent.nested) parent.nested = { ordered: parsed.ordered, items: [] };
          parent.nested.items.push(parsed.text);
          i++;
          continue;
        }
        if (parsed.indent === baseIndent && parsed.ordered === ordered) {
          items.push({ text: parsed.text, nested: null });
          i++;
          continue;
        }
        break;
      }
      const key = `b-${blockIndex++}`;
      const listTag = ordered ? "ol" : "ul";
      blocks.push(
        createElement(
          listTag,
          { key, className: ordered ? "note-ol" : "note-ul" },
          ...items.map((item, idx) =>
            createElement(
              "li",
              { key: `${key}-li-${idx}` },
              createElement(Fragment, null, ...renderInline(item.text, `${key}-li-${idx}`)),
              item.nested
                ? createElement(
                    item.nested.ordered ? "ol" : "ul",
                    { className: item.nested.ordered ? "note-ol note-nested" : "note-ul note-nested" },
                    ...item.nested.items.map((sub, subIdx) =>
                      createElement("li", { key: `${key}-li-${idx}-sub-${subIdx}` }, ...renderInline(sub, `${key}-sub-${idx}-${subIdx}`)),
                    ),
                  )
                : null,
            ),
          ),
        ),
      );
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && !isBlockStart(lines, i)) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    const key = `b-${blockIndex++}`;
    blocks.push(createElement("p", { key }, ...renderParagraphLines(paraLines, key)));
  }

  return blocks;
}
