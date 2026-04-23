import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    // Each test file runs in its own process — setupFiles set env vars
    // before any module (including db.ts) is imported.
    pool: "forks",
    setupFiles: ["tests/server/setup.ts"],
    include: ["tests/server/**/*.test.ts"],
  },
});
