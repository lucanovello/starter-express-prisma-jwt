import { Router, type Request } from "express";

import {
  LoginSchema,
  RegisterSchema,
  RefreshSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "../dto/auth.js";
import { AppError } from "../lib/errors.js";
import * as Auth from "../services/authService.js";

export const auth = Router();

const requireAccessToken = (req: Request) => {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }
  const token = header.slice(7);
  return Auth.authenticateAccessToken(token);
};

// Register
auth.post("/register", async (req, res, next) => {
  try {
    const dto = RegisterSchema.parse(req.body);
    const result = await Auth.register(dto);
    const response: Record<string, unknown> = {
      emailVerificationRequired: result.emailVerificationRequired,
    };
    const { accessToken, refreshToken } = result;
    if (typeof accessToken === "string" && typeof refreshToken === "string") {
      response.accessToken = accessToken;
      response.refreshToken = refreshToken;
    }
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// Login
auth.post("/login", async (req, res, next) => {
  try {
    const dto = LoginSchema.parse(req.body);
    const ipAddress =
      (typeof req.ip === "string" && req.ip.length > 0
        ? req.ip
        : req.socket?.remoteAddress) ?? "unknown";
    const t = await Auth.login(dto, { ipAddress });
    res.status(200).json(t);
  } catch (err) {
    next(err);
  }
});

// Refresh
auth.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const t = await Auth.refresh(refreshToken);
    res.status(200).json(t);
  } catch (err) {
    next(err);
  }
});

// Logout
auth.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    await Auth.logout(refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Verify email
auth.post("/verify-email", async (req, res, next) => {
  try {
    const dto = VerifyEmailSchema.parse(req.body);
    await Auth.verifyEmail(dto.token);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Request password reset
auth.post("/request-password-reset", async (req, res, next) => {
  try {
    const dto = RequestPasswordResetSchema.parse(req.body);
    await Auth.requestPasswordReset(dto.email);
    res.status(202).json({ status: "ok" });
  } catch (err) {
    next(err);
  }
});

// Reset password
auth.post("/reset-password", async (req, res, next) => {
  try {
    const dto = ResetPasswordSchema.parse(req.body);
    await Auth.resetPassword(dto);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// List sessions
auth.get("/sessions", async (req, res, next) => {
  try {
    const { userId, sessionId } = requireAccessToken(req);
    const sessions = await Auth.listSessions(userId, sessionId);
    res.status(200).json({ sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// Logout all sessions
auth.post("/logout-all", async (req, res, next) => {
  try {
    const { userId } = requireAccessToken(req);
    await Auth.logoutAll(userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
