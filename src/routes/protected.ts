import { Router } from "express";

import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const protectedRoutes = Router();

protectedRoutes.get("/admin/ping", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.status(200).json({ status: "ok" });
});

protectedRoutes.get("/users/:userId", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }

    const resource = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { id: true, email: true, role: true },
    });

    if (!resource) {
      throw new AppError("User not found", 404, { code: "USER_NOT_FOUND" });
    }

    const isOwner = resource.id === req.user.id;
    const isAdmin = req.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new AppError("Forbidden", 403, { code: "FORBIDDEN" });
    }

    res.status(200).json({
      user: {
        id: resource.id,
        email: resource.email,
        role: resource.role,
      },
      owner: isOwner,
    });
  } catch (err) {
    next(err);
  }
});
