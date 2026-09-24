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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["server/**/*.ts"],
      exclude: [
        "server/routes.ts",
        "server/createApp.ts",
        "server/db.ts",
        "server/index.ts",
        "server/static.ts",
        "server/vite.ts",
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
