#!/usr/bin/env node

/**
 * Lightweight wrapper to run gitleaks locally with sane defaults that match CI.
 * Prefers a locally installed `gitleaks` binary and falls back to Docker.
 * Pass additional CLI arguments after `--`, e.g. `npm run secrets:scan -- --log-opts main..HEAD`.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);

const baseArgs = [
  "detect",
  "--source",
  ".",
  "--no-banner",
  "--redact",
  "--exit-code",
  "1",
];

const logOpts = process.env.GITLEAKS_LOG_OPTS;
if (logOpts && logOpts.trim().length > 0) {
  baseArgs.push("--log-opts", logOpts.trim());
}

const finalArgs = [...baseArgs, ...args];

function hasBinary(binaryName) {
  const command = process.platform === "win32" ? "where" : "which";
  const lookup = spawnSync(command, [binaryName], {
    stdio: "ignore",
    shell: false,
  });
  return lookup.status === 0;
}

function runCommand(command, commandArgs) {
  const run = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  return run.status ?? 1;
}

if (hasBinary("gitleaks")) {
  process.exit(runCommand("gitleaks", finalArgs));
}

const dockerBinary = process.platform === "win32" ? "docker.exe" : "docker";
if (hasBinary(dockerBinary)) {
  const workspace = path.resolve(process.cwd());
  const dockerArgs = [
    "run",
    "--rm",
    "-v",
    `${workspace}:/repo`,
    "-w",
    "/repo",
    "zricethezav/gitleaks:v8.24.3",
    ...finalArgs.map((arg) => (arg === "." ? "/repo" : arg)),
  ];

  process.exit(runCommand(dockerBinary, dockerArgs));
}

console.error(
  [
    "gitleaks binary not found and Docker is unavailable.",
    "Install gitleaks (https://github.com/gitleaks/gitleaks/releases) or install Docker to run via container.",
  ].join(" "),
);
process.exit(127);
