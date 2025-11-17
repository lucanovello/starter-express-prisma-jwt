import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 70,
      },
      exclude: [
        "dist/**",
        "coverage/**",
        "prisma/**",
        "scripts/**",
        "src/build/**",
        "src/index.ts",
        "src/generated/**",
        "src/types/**",
        "tests/**",
        "vitest.config.ts",
        "*.config.*",
        "**/*.d.ts",
      ],
    },
  },
});
