import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Integration suite — run via `npm run test:integration`.
 * Excluded from default `npm test` (see vitest.config.ts exclude).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
