import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { hashToken } from "../lib/tokenHash.js";
import { hashPassword, verifyPassword } from "../lib/password.js"; // Adjust names if your helpers differ

type RefreshClaims = { sub: string; sid: string };

// -------- Register --------
export async function register(input: { email: string; password: string }) {
  const { email, password } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email already registered", 409, {
      code: "EMAIL_TAKEN",
    });
  }

  const passwordHash = await hashPassword(password);

  // Create user and session, then wire up the refresh token hash
  const { user, session } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, password: passwordHash },
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

    return { user, session: { ...session }, accessToken, refreshToken };
  });

  // Recreate tokens after tx to return (from values above)
  const accessToken = signAccess({ sub: user.id, sessionId: session.id });
  const refreshToken = signRefresh({ sub: user.id, sid: session.id });

  // Persist the (new) refresh hash again to ensure match (safe even if equal)
  await prisma.session.update({
    where: { id: session.id },
    data: { token: await hashToken(refreshToken) },
  });

  return { accessToken, refreshToken };
}

// -------- Login --------
export async function login(input: { email: string; password: string }) {
  const { email, password } = input;

  const user = await prisma.user.findUnique({ where: { email } });
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
  const incomingHash = await hashToken(incomingRefresh);
  if (session.token !== incomingHash) {
    // Optionally revoke all user sessions here.
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
