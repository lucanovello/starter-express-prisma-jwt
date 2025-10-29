import { AppError } from "../lib/errors.js";

import type { Role } from "@prisma/client";
import type { RequestHandler } from "express";

const unauthorized = () => new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
const forbidden = () => new AppError("Forbidden", 403, { code: "FORBIDDEN" });

export const requireRole = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.user) {
    return next(unauthorized());
  }

  if (!roles.includes(req.user.role)) {
    return next(forbidden());
  }

  return next();
};
