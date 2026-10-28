// Copies the pipeline's website JSON (data/web) into public/data so Vite serves and bundles it.
// public/data is gitignored: market-derived files are published only after a terms review.

import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// same rule as the pipeline: MEL_DATA_DIR if set, else <repo>/data
export function defaultSource(env = process.env) {
  const dataDir = env.MEL_DATA_DIR ?? resolve(here, "..", "..", "data");
  return join(dataDir, "web");
}

export function syncData(source, target) {
  if (!existsSync(join(source, "manifest.json"))) {
    throw new Error(
      `${join(source, "manifest.json")} not found; run "python -m macro_event_lab build" first`,
    );
  }
  // start clean so events dropped by the pipeline do not linger
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = resolve(here, "..", "public", "data");
  syncData(defaultSource(), target);
  console.log(`copied ${defaultSource()} to ${target}`);
}
