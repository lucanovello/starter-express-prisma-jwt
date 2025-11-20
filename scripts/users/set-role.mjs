#!/usr/bin/env node

/**
 * Small helper to promote/demote users.
 * Usage: npm run user:set-role -- (--email user@example.com | --id <uuid>) --role ADMIN
 */

import { Role } from "@prisma/client";
import "dotenv/config";
import process from "node:process";

import { prisma } from "../../src/lib/prisma.js";

const args = process.argv.slice(2);

const parseArgs = () => {
  let email;
  let id;
  let role;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    const [flag, value] = arg.split("=", 2);

    if (flag === "--email") {
      email = value ?? args[i + 1];
      if (value === undefined) i += 1;
      continue;
    }

    if (flag === "--id") {
      id = value ?? args[i + 1];
      if (value === undefined) i += 1;
      continue;
    }

    if (flag === "--role") {
      role = value ?? args[i + 1];
      if (value === undefined) i += 1;
    }
  }

  return { email, id, role };
};

const printUsage = () => {
  console.log(
    [
      "Usage:",
      "  npm run user:set-role -- (--email user@example.com | --id <uuid>) --role <ADMIN|USER>",
      "",
      "Examples:",
      "  npm run user:set-role -- --email user@example.com --role ADMIN",
      "  npm run user:set-role -- --id 123e4567-e89b-12d3-a456-426614174000 --role USER",
    ].join("\n"),
  );
};

const main = async () => {
  const { email, id, role, help } = parseArgs();

  if (help) {
    printUsage();
    return;
  }

  if ((!email && !id) || !role) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const normalizedRole = role.toUpperCase();
  const validRoles = Object.values(Role);

  if (!validRoles.includes(normalizedRole)) {
    console.error(`[user:set-role] invalid role "${role}". Expected one of: ${validRoles.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (email && id) {
    console.warn("[user:set-role] both --email and --id provided; defaulting to --id");
  }

  const selector = id ? { id } : { email };
  const descriptor = id ? `id=${id}` : `email=${email}`;

  try {
    const current = await prisma.user.findUnique({
      where: selector,
      select: { id: true, email: true, role: true },
    });

    if (!current) {
      console.error(`[user:set-role] no user found for ${descriptor}`);
      process.exitCode = 1;
      return;
    }

    if (current.role === normalizedRole) {
      console.log(`[user:set-role] no change: ${descriptor} already has role ${normalizedRole}`);
      return;
    }

    const updated = await prisma.user.update({
      where: selector,
      data: { role: normalizedRole },
      select: { id: true, email: true, role: true },
    });

    console.log(
      `[user:set-role] updated ${updated.id} (${updated.email}): ${current.role} -> ${updated.role}`,
    );
  } catch (error) {
    console.error("[user:set-role] failed to update role", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

await main();
