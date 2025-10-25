import { AppError } from "../lib/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { hashToken, tokenEqualsHash } from "../lib/tokenHash.js";

type RefreshClaims = { sub: string; sid: string };

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

      const session = await tx.session.create({
        data: { userId: user.id, valid: true, token: "" }, // placeholder, update next
      });

      // Now that we have a session id, mint tokens
      const accessToken = signAccess({ sub: user.id, sessionId: session.id });
      const refreshToken = signRefresh({ sub: user.id, sid: session.id });

      // Store hash of refresh token on the session
      const tokenHash = await hashToken(refreshToken);
      await tx.session.update({
        where: { id: session.id },
        data: { token: tokenHash },
      });

      return { accessToken, refreshToken };
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

  const session = await prisma.session.create({
    data: { userId: user.id, valid: true, token: "" },
  });

  const accessToken = signAccess({ sub: user.id, sessionId: session.id });
  const refreshToken = signRefresh({ sub: user.id, sid: session.id });

  await prisma.session.update({
    where: { id: session.id },
    data: { token: await hashToken(refreshToken) },
  });

  return { accessToken, refreshToken };
}

// -------- Refresh (rotate) --------
export async function refresh(incomingRefresh: string) {
  if (!incomingRefresh) {
    throw new AppError("Refresh token required", 400, {
      code: "REFRESH_REQUIRED",
    });
  }

  const payload = verifyRefresh<RefreshClaims>(incomingRefresh);
  const { sub: userId, sid: sessionId } = payload;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || !session.valid) {
    throw new AppError("Invalid session", 401, { code: "SESSION_INVALID" });
  }

  // Reuse detection – must match stored hash
  if (!tokenEqualsHash(incomingRefresh, session.token)) {
    // Revoke all user sessions on token reuse (possible theft)
    await prisma.session.updateMany({
      where: { userId: session.userId },
      data: { valid: false, token: "" },
    });
    throw new AppError("Invalid token", 401, { code: "REFRESH_REUSE" });
  }

  // Mint a new pair (signRefresh adds unique jti so string differs)
  const accessToken = signAccess({ sub: userId, sessionId });
  const newRefresh = signRefresh({ sub: userId, sid: sessionId });

  await prisma.session.update({
    where: { id: sessionId },
    data: { token: await hashToken(newRefresh) },
  });

  return { accessToken, refreshToken: newRefresh };
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
