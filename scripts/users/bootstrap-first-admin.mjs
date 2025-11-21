#!/usr/bin/env node

/**
 * One-time helper to promote an existing user to ADMIN.
 * Usage: npm run bootstrap:first-admin -- (--email user@example.com | --id <uuid>)
 */

import { Role } from "@prisma/client";
import "dotenv/config";
import process from "node:process";

import { prisma } from "../../src/lib/prisma.js";

const args = process.argv.slice(2);

const parseArgs = () => {
  let email;
  let id;

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
    }
  }

  return { email, id };
};

const printUsage = () => {
  console.log(
    [
      "Usage:",
      "  npm run bootstrap:first-admin -- (--email user@example.com | --id <uuid>)",
      "",
      "Examples:",
      "  npm run bootstrap:first-admin -- --email admin@example.com",
      "  npm run bootstrap:first-admin -- --id 123e4567-e89b-12d3-a456-426614174000",
      "",
      "Tip: the script only changes role=ADMIN; register the user first via /auth/register.",
    ].join("\n"),
  );
};

const main = async () => {
  const { email, id, help } = parseArgs();

  if (help) {
    printUsage();
    return;
  }

  if (!email && !id) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (email && id) {
    console.warn("[bootstrap-first-admin] both --email and --id provided; defaulting to --id");
  }

  const selector = id ? { id } : { email };
  const descriptor = id ? `id=${id}` : `email=${email}`;

  try {
    const current = await prisma.user.findUnique({
      where: selector,
      select: { id: true, email: true, role: true },
    });

    if (!current) {
      console.error(`[bootstrap-first-admin] no user found for ${descriptor}`);
      process.exitCode = 1;
      return;
    }

    if (current.role === Role.ADMIN) {
      console.log(`[bootstrap-first-admin] no change: ${descriptor} already has role ADMIN`);
      return;
    }

    const updated = await prisma.user.update({
      where: selector,
      data: { role: Role.ADMIN },
      select: { id: true, email: true, role: true },
    });

    console.log(
      `[bootstrap-first-admin] updated ${updated.id} (${updated.email}): ${current.role} -> ${updated.role}`,
    );
    console.log("[bootstrap-first-admin] remove this helper once your app owns admin creation.");
  } catch (error) {
    console.error("[bootstrap-first-admin] failed to promote user", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

await main();
