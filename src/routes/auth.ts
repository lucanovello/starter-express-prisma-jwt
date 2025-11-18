import { Router } from "express";

import {
  LoginSchema,
  RegisterSchema,
  RefreshSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "../dto/auth.js";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validateRequest } from "../middleware/validate.js";
import * as Auth from "../services/authService.js";

import type {
  LoginInput,
  RefreshInput,
  RegisterInput,
  RequestPasswordResetInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "../dto/auth.js";

export const auth = Router();

// Register
auth.post("/register", validateRequest({ body: RegisterSchema }), async (req, res, next) => {
  try {
    const dto = req.body as RegisterInput;
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
auth.post("/login", validateRequest({ body: LoginSchema }), async (req, res, next) => {
  try {
    const dto = req.body as LoginInput;
    const ipAddress =
      (typeof req.ip === "string" && req.ip.length > 0 ? req.ip : req.socket?.remoteAddress) ??
      "unknown";
    const t = await Auth.login(dto, { ipAddress });
    res.status(200).json(t);
  } catch (err) {
    next(err);
  }
});

// Refresh
auth.post("/refresh", validateRequest({ body: RefreshSchema }), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    const t = await Auth.refresh(refreshToken);
    res.status(200).json(t);
  } catch (err) {
    next(err);
  }
});

// Logout
auth.post("/logout", validateRequest({ body: RefreshSchema }), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    await Auth.logout(refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Verify email
auth.post("/verify-email", validateRequest({ body: VerifyEmailSchema }), async (req, res, next) => {
  try {
    const dto = req.body as VerifyEmailInput;
    await Auth.verifyEmail(dto.token);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Request password reset
auth.post(
  "/request-password-reset",
  validateRequest({ body: RequestPasswordResetSchema }),
  async (req, res, next) => {
    try {
      const dto = req.body as RequestPasswordResetInput;
      await Auth.requestPasswordReset(dto.email);
      res.status(202).json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  },
);

// Reset password
auth.post(
  "/reset-password",
  validateRequest({ body: ResetPasswordSchema }),
  async (req, res, next) => {
    try {
      const dto = req.body as ResetPasswordInput;
      await Auth.resetPassword(dto);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

// List sessions
auth.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const { id: userId, sessionId } = req.user ?? {};
    if (!userId) {
      throw new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }
    const sessions = await Auth.listSessions(userId, sessionId ?? null);
    res.status(200).json({ sessions, count: sessions.length });
  } catch (err) {
    next(err);
  }
});

// Logout all sessions
auth.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
    }
    await Auth.logoutAll(userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
