import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { authenticateAccessToken } from "../services/authService.js";

import type { RequestHandler } from "express";

const unauthorized = () => new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const header = req.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = header.slice(7).trim();
    if (!token) {
      throw unauthorized();
    }

    const { userId, sessionId } = authenticateAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw unauthorized();
    }

    let attachedSessionId = sessionId;

    if (sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, valid: true },
      });

      if (!session || session.userId !== user.id) {
        throw unauthorized();
      }

      if (!session.valid) {
        attachedSessionId = null;
      }
    }

    req.user = {
      id: user.id,
      role: user.role,
      sessionId: attachedSessionId,
    };
    res.locals.userId = user.id;
    res.locals.sessionId = attachedSessionId;

    return next();
  } catch (err) {
    return next(err);
  }
};
