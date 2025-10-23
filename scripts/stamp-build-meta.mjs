/**
 * Generates src/build/meta.ts with version, git sha, and build timestamp.
 * Runs before tsc so imports work at runtime.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function safe(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf-8")
);
const version = pkg.version ?? "0.0.0";
const gitSha = safe("git rev-parse --short HEAD");
const buildTime = new Date().toISOString();

const outDir = resolve(__dirname, "../src/build");
mkdirSync(outDir, { recursive: true });

const outFile = resolve(outDir, "meta.ts");
const source = `export const BUILD_VERSION = ${JSON.stringify(
  version
)} as const;
export const BUILD_GIT_SHA = ${JSON.stringify(gitSha)} as const;
export const BUILD_TIME = ${JSON.stringify(buildTime)} as const;
`;

writeFileSync(outFile, source, "utf-8");
console.log("[build] wrote", outFile);
