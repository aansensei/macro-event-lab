import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { collectOpenDataSizes, collectPublicAssets } from "./scripts/publicAssets.ts";

const publicDir = fileURLToPath(new URL("./public", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// the site is served from static files only; relative paths keep it working under any base URL
export default defineConfig({
  base: "./",
  publicDir: process.env.VITE_EDITION === "public" ? false : "public",
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  define: {
    __OPEN_DATA_SIZES__: JSON.stringify(collectOpenDataSizes(publicDir)),
  },
  plugins: [react(), {
    name: "public-assets",
    apply: "build",
    generateBundle() {
      if (process.env.VITE_EDITION !== "public") return;
      for (const asset of collectPublicAssets("public")) this.emitFile({ type: "asset", ...asset });
    },
  }],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    setupFiles: ["./src/testSetup.ts"],
  },
});
