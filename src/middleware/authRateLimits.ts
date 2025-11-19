import type { RequestHandler } from "express";

const passthrough: RequestHandler = (_req, _res, next) => next();

let registerLimiter: RequestHandler = passthrough;
let requestPasswordResetLimiter: RequestHandler = passthrough;

export const authRegisterRateLimit: RequestHandler = (req, res, next) =>
  registerLimiter(req, res, next);

export const authRequestPasswordResetRateLimit: RequestHandler = (req, res, next) =>
  requestPasswordResetLimiter(req, res, next);

export const setAuthRegisterRateLimit = (limiter: RequestHandler): void => {
  registerLimiter = limiter;
};

export const setAuthRequestPasswordResetRateLimit = (limiter: RequestHandler): void => {
  requestPasswordResetLimiter = limiter;
};
