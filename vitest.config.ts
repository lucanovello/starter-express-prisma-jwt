import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Runs in every worker – sets the env var before tests execute
    setupFiles: ["./vitest.setup.ts", "tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "dist/**",
        "prisma/**",
        "src/generated/**",
        "src/types/**",
        "vitest.config.ts",
      ],
    },
  },
});
