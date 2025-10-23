/**
 * Attaches a userId to the request logger when a valid Bearer token is present.
 * - No auth is enforced here; failures are ignored.
 * - userId is taken from payload.userId or payload.sub if present.
 */

import type { Request, Response, NextFunction } from "express";
import { verifyAccess } from "../lib/jwt.js";

export function attachUserToLog(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token) {
    try {
      const payload = verifyAccess<{ userId?: string; sub?: string }>(token);
      const userId = payload.userId ?? payload.sub;
      if (userId) {
        // pino-http provides per-request loggers. Prefer setBindings if available.
        const anyLog = req.log as any;
        if (typeof anyLog.setBindings === "function") {
          anyLog.setBindings({ userId });
        } else {
          // fallback: create a child logger
          // @ts-ignore - pino child exists
          req.log = req.log.child({ userId });
        }
        res.locals.userId = userId;
      }
    } catch {
      // ignore token errors; this middleware never throws
    }
  }

  next();
}
