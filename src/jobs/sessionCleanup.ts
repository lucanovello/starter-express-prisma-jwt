import { setInterval } from "node:timers";

import { getConfig } from "../config/index.js";
import { prisma } from "../lib/prisma.js";

import type { Prisma } from "@prisma/client";

const unitsToMs: Record<string, number> = {
  ms: 1,
  msec: 1,
  msecs: 1,
  millisecond: 1,
  milliseconds: 1,
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
  y: 31_536_000_000,
  yr: 31_536_000_000,
  yrs: 31_536_000_000,
  year: 31_536_000_000,
  years: 31_536_000_000,
};

const parseExpiryToMs = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return numeric > 0 ? numeric * 1000 : null;
  }

  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i,
  );

  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const unitKey = match[2].toLowerCase();
  const unitMs = unitsToMs[unitKey];
  if (!unitMs) return null;

  return amount * unitMs;
};

export async function cleanupExpiredSessions(reference: Date = new Date()): Promise<number> {
  const cfg = getConfig();
  const refreshTtlMs = parseExpiryToMs(cfg.JWT_REFRESH_EXPIRY) ?? undefined;

  const conditions: Prisma.SessionWhereInput[] = [{ valid: false }];

  if (refreshTtlMs && refreshTtlMs > 0) {
    const updatedBefore = new Date(reference.getTime() - refreshTtlMs);
    conditions.push({ updatedAt: { lte: updatedBefore } });
  }

  const where: Prisma.SessionWhereInput =
    conditions.length === 1 ? conditions[0] : { OR: conditions };

  const result = await prisma.session.deleteMany({ where });
  return result.count;
}

type Logger = {
  info?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
};

type ScheduleOptions = {
  intervalMs?: number;
  logger?: Logger;
};

export function scheduleSessionCleanup(options: ScheduleOptions = {}): () => void {
  const cfg = getConfig();
  const intervalMs = options.intervalMs ?? cfg.SESSION_CLEANUP_INTERVAL_MINUTES * 60 * 1000;
  const logger = options.logger ?? console;

  let running = false;

  const runCleanup = async () => {
    if (running) return;
    running = true;
    try {
      const removed = await cleanupExpiredSessions();
      if (removed > 0 && typeof logger.info === "function") {
        logger.info(`[sessionCleanup] removed ${removed} expired/invalid session(s)`);
      }
    } catch (err) {
      if (typeof logger.error === "function") {
        logger.error("[sessionCleanup] cleanup failed", err);
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void runCleanup();
  }, intervalMs);
  timer.unref();

  void runCleanup();

  return () => {
    clearInterval(timer);
  };
}
