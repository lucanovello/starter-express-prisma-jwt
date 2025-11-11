#!/usr/bin/env node
/**
 * Local Gitleaks wrapper with two modes:
 *  - history scan (default):  gitleaks detect ... [--log-opts <range>]
 *  - staged scan:             gitleaks protect --staged ...
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const argv = process.argv.slice(2);
let mode = "detect";
const idx = argv.findIndex((a) => a === "--mode=protect-staged");
if (idx !== -1) {
  mode = "protect-staged";
  argv.splice(idx, 1);
}

function has(bin) {
  const cmd = process.platform === "win32" ? "where" : "which";
  return spawnSync(cmd, [bin], { stdio: "ignore" }).status === 0;
}
function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit", env: process.env }).status ?? 1;
}

function buildArgs() {
  const common = ["--no-banner", "--redact", "--exit-code", "1"];
  if (mode === "protect-staged") return ["protect", "--staged", ...common];
  const args = ["detect", "--source", ".", ...common];
  const logOpts = process.env.GITLEAKS_LOG_OPTS;
  if (logOpts && logOpts.trim()) args.push("--log-opts", logOpts.trim());
  return args;
}
const finalArgs = [...buildArgs(), ...argv];

if (has("gitleaks")) process.exit(run("gitleaks", finalArgs));

const docker = process.platform === "win32" ? "docker.exe" : "docker";
if (has(docker)) {
  const workspace = path.resolve(process.cwd());
  const mapped = finalArgs.map((a) => (a === "." ? "/repo" : a));
  const dargs = [
    "run",
    "--rm",
    "-v",
    `${workspace}:/repo`,
    "-w",
    "/repo",
    "zricethezav/gitleaks:v8.24.3",
    ...mapped,
  ];
  process.exit(run(docker, dargs));
}

console.error("gitleaks not found and Docker unavailable.");
process.exit(127);
