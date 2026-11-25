import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx|html)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// an anchor whose address starts with http, https or mailto in the source must open in a new tab
it("opens every anchor written with an outside address in a new tab", () => {
  const files = [...sourceFiles(join(process.cwd(), "src")), join(process.cwd(), "index.html")];
  const offenders: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/<a\s[^>]*href=("|\{")(https?:|mailto:)[^>]*>/g)) {
      if (!/target="_blank"/.test(match[0]) || !/rel="noopener noreferrer"/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 80)}`);
    }
  }
  expect(offenders).toEqual([]);
});

it("keeps the shared external link component on a new tab with no access back", () => {
  const text = readFileSync(join(process.cwd(), "src/components/ExternalLink.tsx"), "utf8");
  expect(text).toContain('target="_blank"');
  expect(text).toContain('rel="noopener noreferrer"');
});
