import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// the site is served from static files only; relative paths keep it working under any base URL
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
