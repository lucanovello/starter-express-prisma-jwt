import { randomUUID } from "node:crypto";

import { AppError } from "../lib/errors.js";
import { decodeRefresh, signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, tokenEqualsHash } from "../lib/tokenHash.js";

type RefreshClaims = { sub: string; sid: string };

type MintedSessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshHash: string;
};

async function mintSessionTokens(userId: string, sessionId: string): Promise<MintedSessionTokens> {
  const accessToken = signAccess({ sub: userId, sessionId });
  const refreshToken = signRefresh({ sub: userId, sid: sessionId });
  const refreshHash = await hashToken(refreshToken);

  return { accessToken, refreshToken, refreshHash };
}

// -------- Register --------
export async function register(input: { email: string; password: string }) {
  const { email, password } = input;

  const emailLc = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: emailLc } });
  if (existing) {
    throw new AppError("Email already registered", 409, { code: "EMAIL_TAKEN" });
  }

  const passwordHash = await hashPassword(password);

  try {
    const { accessToken, refreshToken } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: emailLc, password: passwordHash },
      });

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

      return { accessToken: minted.accessToken, refreshToken: minted.refreshToken };
    });
    return { accessToken, refreshToken };
  } catch (err: any) {
    if (err?.code === "P2002") {
      const t = Array.isArray(err.meta?.target)
        ? err.meta.target.join(",")
        : (err.meta?.target ?? "");
      if (String(t).includes("email")) {
        throw new AppError("Email already registered", 409, { code: "EMAIL_TAKEN" });
      }
    }
    throw err;
  }
}

// -------- Login --------
export async function login(input: { email: string; password: string }) {
  const { email, password } = input;
  // Find the user case-insensitively by email
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (!user) {
    throw new AppError("Invalid credentials", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

  const ok = await verifyPassword(user.password, password);
  if (!ok) {
    throw new AppError("Invalid credentials", 401, {
      code: "INVALID_CREDENTIALS",
    });
  }

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
    if (
      err instanceof AppError &&
      err.code === "SESSION_EXPIRED" &&
      fallbackSessionId
    ) {
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
