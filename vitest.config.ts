import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
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
