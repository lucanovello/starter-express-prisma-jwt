import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "prisma/**", "src/build/**"],
  },
  {
    files: ["**/*.ts"],
    ignores: ["tests/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
      },
      ecmaVersion: 2023,
      sourceType: "module",
    },
    plugins: { "@typescript-eslint": tsPlugin, import: importPlugin },
    rules: {
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external", "internal"],
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module" },
    plugins: { import: importPlugin },
    rules: {
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external", "internal"],
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: ["vitest.config.ts", "vitest.setup.ts", "*.config.*", "scripts/**/*.{ts,mts,cts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },
    },
    rules: {
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
];
