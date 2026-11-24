import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { collectPublicAssets } from "./scripts/publicAssets.ts";

// the site is served from static files only; relative paths keep it working under any base URL
export default defineConfig({
  base: "./",
  publicDir: process.env.VITE_EDITION === "public" ? false : "public",
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
  },
});
