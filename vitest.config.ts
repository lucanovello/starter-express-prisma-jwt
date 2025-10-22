import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup-env.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "dist/**", // built js
        "prisma/**", // schema/migrations
        "src/generated/**", // future-proof: ignore generated code
        "src/types/**",
        "vitest.config.ts",
      ],
    },
  },
});
