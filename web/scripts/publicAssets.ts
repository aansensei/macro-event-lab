import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const PUBLIC_DATA_FILES = [
  "revisions.json",
  "nowcast.json",
  "status.json",
  "arena.json",
  "briefing.json",
  "ledger.json",
  "calendar.ics",
  "feed.xml",
  "arena_forecasts.parquet",
  "arena_scores.parquet",
  "revisions.parquet",
  "arena_forecasts.csv",
  "arena_scores.csv",
  "revisions.csv",
] as const;

export function collectOpenDataSizes(publicDir: string): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const name of PUBLIC_DATA_FILES) {
    if (!name.endsWith(".parquet") && !name.endsWith(".csv")) continue;
    const path = join(publicDir, "data", name);
    if (!existsSync(path)) continue;
    sizes[name] = statSync(path).size;
  }
  return sizes;
}

export function collectPublicAssets(publicDir: string): { fileName: string; source: Uint8Array }[] {
  const assets: { fileName: string; source: Uint8Array }[] = [];
  if (!existsSync(publicDir)) return assets;
  const pending = [""];
  while (pending.length > 0) {
    const relative = pending.pop()!;
    for (const entry of readdirSync(join(publicDir, relative), { withFileTypes: true })) {
      const fileName = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (fileName !== "data") pending.push(fileName);
        continue;
      }
      assets.push({ fileName, source: readFileSync(join(publicDir, fileName)) });
    }
  }
  for (const name of PUBLIC_DATA_FILES) {
    const fileName = `data/${name}`;
    const path = join(publicDir, fileName);
    if (!existsSync(path)) continue;
    const source = readFileSync(path);
    if (!name.endsWith(".parquet") && /kalshi|KX/i.test(source.toString("utf8"))) {
      throw new Error(`Public data contains a restricted source identifier: ${fileName}. Rebuild public data first.`);
    }
    assets.push({ fileName, source });
  }
  return assets;
}
