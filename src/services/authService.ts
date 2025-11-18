import { randomBytes, randomUUID } from "node:crypto";

import { getConfig } from "../config/index.js";
import { AppError } from "../lib/errors.js";
import { decodeRefresh, signAccess, signRefresh, verifyAccess, verifyRefresh } from "../lib/jwt.js";
import { getLogger } from "../lib/logger.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, tokenEqualsHash } from "../lib/tokenHash.js";

import { getEmailService } from "./emailService.js";

import type { Prisma } from "@prisma/client";

type RefreshClaims = { sub: string; sid: string };

type MintedSessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
};

type RegisterResult = {
  accessToken?: string;
  refreshToken?: string;
  emailVerificationRequired: boolean;
  verificationToken?: string;
};

type LoginContext = {
  ipAddress: string;
};

type SessionSummary = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  valid: boolean;
  current: boolean;
};

type AuthConfig = ReturnType<typeof getConfig>["auth"];

const TOKEN_BYTES = 32;

const makeLoginError = () =>
  new AppError("Invalid credentials", 401, {
    code: "INVALID_CREDENTIALS",
  });

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeIp(ip: string | undefined | null): string {
  if (!ip) return "unknown";
  return ip.slice(0, 128);
}

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

async function mintSessionTokens(userId: string, sessionId: string): Promise<MintedSessionTokens> {
  const accessToken = signAccess({ sub: userId, sessionId });
  const refreshToken = signRefresh({ sub: userId, sid: sessionId });
  const refreshHash = await hashToken(refreshToken);

  return { accessToken, refreshToken, refreshHash };
}

async function createVerificationToken(
  tx: Prisma.TransactionClient,
  userId: string,
  auth: AuthConfig,
): Promise<string> {
  await tx.verificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const expiresAt = new Date(Date.now() + auth.emailVerificationTtlMs);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    try {
      await tx.verificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
      return rawToken;
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }

  throw new Error("Unable to create verification token");
}

async function createPasswordResetToken(
  tx: Prisma.TransactionClient,
  userId: string,
  auth: AuthConfig,
): Promise<string> {
  await tx.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const expiresAt = new Date(Date.now() + auth.passwordResetTtlMs);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    try {
      await tx.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
      return rawToken;
    } catch (err: any) {
      if (err?.code === "P2002") continue;
      throw err;
    }
  }

  throw new Error("Unable to create password reset token");
}

async function ensureLoginNotLocked(
  emailLowercase: string,
  ipAddress: string,
  auth: AuthConfig,
): Promise<void> {
  const key = { emailLowercase, ipAddress };
  const attempt = await prisma.loginAttempt.findUnique({
    where: { emailLowercase_ipAddress: key },
  });
  if (!attempt) return;

  const now = new Date();

  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    throw new AppError("Too many login attempts. Try again later.", 429, {
      code: "LOGIN_LOCKED",
    });
  }

  if (
    attempt.lockedUntil ||
    now.getTime() - attempt.lastFailedAt.getTime() > auth.loginAttemptWindowMs
  ) {
    await prisma.loginAttempt
      .delete({ where: { emailLowercase_ipAddress: key } })
      .catch(() => undefined);
  }
}

async function recordLoginFailure(
  emailLowercase: string,
  ipAddress: string,
  userId: string | null,
  auth: AuthConfig,
): Promise<void> {
  const key = { emailLowercase, ipAddress };
  const attempt = await prisma.loginAttempt.findUnique({
    where: { emailLowercase_ipAddress: key },
  });
  const now = new Date();
  const withinWindow =
    attempt && now.getTime() - attempt.lastFailedAt.getTime() <= auth.loginAttemptWindowMs;

  const failCount = withinWindow ? attempt!.failCount + 1 : 1;
  const shouldLock = failCount >= auth.loginMaxAttempts;
  const lockedUntil = shouldLock ? new Date(now.getTime() + auth.loginLockoutMs) : null;

  if (!attempt) {
    await prisma.loginAttempt.create({
      data: {
        emailLowercase,
        ipAddress,
        failCount,
        firstFailedAt: now,
        lastFailedAt: now,
        lockedUntil,
        userId: userId ?? undefined,
      },
    });
    return;
  }

  if (!withinWindow || attempt.lockedUntil) {
    await prisma.loginAttempt.update({
      where: { emailLowercase_ipAddress: key },
      data: {
        failCount: 1,
        firstFailedAt: now,
        lastFailedAt: now,
        lockedUntil,
        userId: attempt.userId ?? userId ?? undefined,
      },
    });
    return;
  }

  await prisma.loginAttempt.update({
    where: { emailLowercase_ipAddress: key },
    data: {
      failCount,
      lastFailedAt: now,
      lockedUntil,
      userId: attempt.userId ?? userId ?? undefined,
    },
  });
}

async function clearLoginAttempts(emailLowercase: string, ipAddress: string): Promise<void> {
  await prisma.loginAttempt
    .delete({ where: { emailLowercase_ipAddress: { emailLowercase, ipAddress } } })
    .catch(() => undefined);
}

// -------- Register --------
export async function register(input: {
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const { email, password } = input;
  const emailLowercase = normalizeEmail(email);

  const existing = await prisma.user.findUnique({ where: { email: emailLowercase } });
  if (existing) {
    throw new AppError("Email already registered", 409, { code: "EMAIL_TAKEN" });
  }

  const passwordHash = await hashPassword(password);
  const auth = getConfig().auth;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLowercase,
          password: passwordHash,
          emailVerifiedAt: auth.emailVerificationRequired ? null : new Date(),
        },
      });

      let verificationToken: string | undefined;
      if (auth.emailVerificationRequired) {
        verificationToken = await createVerificationToken(tx, user.id, auth);
      }

      if (auth.emailVerificationRequired) {
        return {
          email: emailLowercase,
          emailVerificationRequired: true,
          verificationToken,
        };
      }

      const sessionId = randomUUID();
      const minted = await mintSessionTokens(user.id, sessionId);

      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          valid: true,
          token: minted.refreshHash,
        },
      });

      return {
        email: emailLowercase,
        accessToken: minted.accessToken,
        refreshToken: minted.refreshToken,
        emailVerificationRequired: false,
        verificationToken,
      };
    });

    // Send verification email after successful transaction
    if (result.emailVerificationRequired && result.verificationToken) {
      const emailService = getEmailService();
      const logger = getLogger();
      // Fire and forget - don't block the response
      emailService.sendVerificationEmail(result.email, result.verificationToken).catch((err) => {
        logger.error({ err, recipient: result.email }, "Failed to send verification email");
      });
    }

    // Remove email from result before returning
    const { email: _email, ...returnResult } = result;
    return returnResult;
  } catch (err: any) {
    if (err?.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : err.meta?.target;
      if (String(target ?? "").includes("email")) {
        throw new AppError("Email already registered", 409, { code: "EMAIL_TAKEN" });
      }
    }
    throw err;
  }
}

// -------- Login --------
export async function login(input: { email: string; password: string }, context: LoginContext) {
  const auth = getConfig().auth;
  const emailLowercase = normalizeEmail(input.email);
  const ipAddress = sanitizeIp(context.ipAddress);

  await ensureLoginNotLocked(emailLowercase, ipAddress, auth);

  const user = await prisma.user.findUnique({
    where: { email: emailLowercase },
  });

  if (!user) {
    await recordLoginFailure(emailLowercase, ipAddress, null, auth);
    throw makeLoginError();
  }

  const ok = await verifyPassword(user.password, input.password);
  if (!ok || (auth.emailVerificationRequired && !user.emailVerifiedAt)) {
    await recordLoginFailure(emailLowercase, ipAddress, user.id, auth);
    throw makeLoginError();
  }

  await clearLoginAttempts(emailLowercase, ipAddress);

  const sessionId = randomUUID();
  const minted = await mintSessionTokens(user.id, sessionId);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      valid: true,
      token: minted.refreshHash,
    },
  });

  return { accessToken: minted.accessToken, refreshToken: minted.refreshToken };
}

// -------- Refresh (rotate) --------
export async function refresh(incomingRefresh: string) {
  if (!incomingRefresh) {
    throw new AppError("Refresh token required", 400, {
      code: "REFRESH_REQUIRED",
    });
  }

  const decoded = decodeRefresh<RefreshClaims>(incomingRefresh);
  const fallbackSessionId = decoded?.sid ?? null;

  let payload: RefreshClaims;
  try {
    payload = verifyRefresh<RefreshClaims>(incomingRefresh);
  } catch (err) {
    if (err instanceof AppError && err.code === "SESSION_EXPIRED" && fallbackSessionId) {
      await prisma.session.updateMany({
        where: { id: fallbackSessionId },
        data: { valid: false, token: "" },
      });
    }
    throw err;
  }

  const { sub: userId, sid: sessionId } = payload;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.valid) {
    throw new AppError("Invalid session", 401, { code: "SESSION_INVALID" });
  }

  // Reuse detection: must match stored hash
  if (!tokenEqualsHash(incomingRefresh, session.token)) {
    // Revoke all user sessions on token reuse (possible theft)
    await prisma.session.updateMany({
      where: { userId: session.userId },
      data: { valid: false, token: "" },
    });
    throw new AppError("Invalid token", 401, { code: "REFRESH_REUSE" });
  }

  const minted = await mintSessionTokens(userId, sessionId);

  await prisma.session.update({
    where: { id: sessionId },
    data: { token: minted.refreshHash },
  });

  return { accessToken: minted.accessToken, refreshToken: minted.refreshToken };
}

// -------- Logout --------
export async function logout(incomingRefresh: string) {
  if (!incomingRefresh) return;

  try {
    const payload = verifyRefresh<RefreshClaims>(incomingRefresh);
    const { sid } = payload;

    // Invalidate the session and clear the stored hash
    await prisma.session.update({
      where: { id: sid },
      data: { valid: false, token: "" },
    });
  } catch {
    // ignore bogus tokens; logout is idempotent
  }
}

// -------- Email verification --------
export async function verifyEmail(token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt) {
    throw new AppError("Invalid verification token", 400, {
      code: "EMAIL_VERIFICATION_INVALID",
    });
  }

  const now = new Date();
  if (record.expiresAt <= now) {
    await prisma.verificationToken
      .update({
        where: { id: record.id },
        data: { usedAt: now },
      })
      .catch(() => undefined);
    throw new AppError("Verification token expired", 400, {
      code: "EMAIL_VERIFICATION_EXPIRED",
    });
  }

  await prisma.$transaction(async (tx) => {
    if (!record.user.emailVerifiedAt) {
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: now },
      });
    }
    await tx.verificationToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    await tx.verificationToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
  });
}

export async function requestPasswordReset(email: string): Promise<{ token?: string }> {
  const auth = getConfig().auth;
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  if (!user) {
    return {};
  }

  const token = await prisma.$transaction(async (tx) =>
    createPasswordResetToken(tx, user.id, auth),
  );

  // Send password reset email - fire and forget
  const emailService = getEmailService();
  const logger = getLogger();
  emailService.sendPasswordResetEmail(user.email, token).catch((err) => {
    logger.error(
      { err, userId: user.id, recipient: user.email },
      "Failed to send password reset email",
    );
  });

  return { token };
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  const tokenHash = await hashToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true } } },
  });

  if (!record || record.usedAt) {
    throw new AppError("Invalid reset token", 400, {
      code: "PASSWORD_RESET_INVALID",
    });
  }

  const now = new Date();
  if (record.expiresAt <= now) {
    await prisma.passwordResetToken
      .update({
        where: { id: record.id },
        data: { usedAt: now },
      })
      .catch(() => undefined);
    throw new AppError("Reset token expired", 400, {
      code: "PASSWORD_RESET_EXPIRED",
    });
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { password: passwordHash },
    });
    await tx.session.updateMany({
      where: { userId: record.userId },
      data: { valid: false, token: "" },
    });
  });
}

export function authenticateAccessToken(token: string): {
  userId: string;
  sessionId: string | null;
} {
  if (!token) {
    throw new AppError("Unauthorized", 401, { code: "UNAUTHORIZED" });
  }

  const payload = verifyAccess<{ sub?: string; userId?: string; sessionId?: string }>(token);
  const userId = payload.sub ?? payload.userId;
  if (!userId) {
    throw new AppError("Invalid access token", 401, { code: "JWT_ACCESS_INVALID" });
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null;
  return { userId, sessionId };
}

export async function listSessions(
  userId: string,
  currentSessionId: string | null,
): Promise<SessionSummary[]> {
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    valid: session.valid,
    current: currentSessionId != null && session.id === currentSessionId,
  }));
}

export async function logoutAll(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId },
    data: { valid: false, token: "" },
  });
  return result.count;
}
