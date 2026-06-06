import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    coverage: {
      provider: "v8",
      include: ["src/db/**/*.ts", "src/game/**/*.ts", "src/services/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
      thresholds: {
        statements: 97,
        branches: 89,
        functions: 98,
        lines: 97
      }
    }
  }
});
