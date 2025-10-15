import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { hashRefresh } from "../lib/tokenHash.js";

export type LoginDTO = { email: string; password: string };
export type RegisterDTO = { email: string; password: string };
export type Tokens = { accessToken: string; refreshToken: string };

/**
 * Login with email/password.
 * WHY: Hash-safe credential check, then issue access+refresh and persist session.
 */
export async function login({ email, password }: LoginDTO): Promise<Tokens> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid credentials", 401, { code: "BAD_CREDENTIALS" });
  }

  const ok = await verifyPassword(user.password, password);
  if (!ok) {
    throw new AppError("Invalid credentials", 401, { code: "BAD_CREDENTIALS" });
  }

  const accessToken = signAccess({ sub: user.id });
  const refreshToken = signRefresh({ sub: user.id }); // payload object (matches jwt.ts)

  await prisma.session.create({
    data: { userId: user.id, token: hashRefresh(refreshToken), valid: true },
  });

  return { accessToken, refreshToken };
}

/**
 * Register a new user and issue tokens.
 */
export async function register({
  email,
  password,
}: RegisterDTO): Promise<Tokens> {
  const pwd = await hashPassword(password);
  try {
    const user = await prisma.user.create({ data: { email, password: pwd } });

    const accessToken = signAccess({ sub: user.id });
    const refreshToken = signRefresh({ sub: user.id });

    await prisma.session.create({
      data: { userId: user.id, token: hashRefresh(refreshToken), valid: true },
    });

    return { accessToken, refreshToken };
  } catch (e: any) {
    // Unique email constraint (Prisma P2002).
    if (e?.code === "P2002" && e?.meta?.target?.includes("email")) {
      throw new AppError("Email already in use", 409, { code: "EMAIL_TAKEN" });
    }
    throw e;
  }
}

/**
 * Rotate a refresh token; detect reuse and revoke all sessions if detected.
 */
export async function refresh(oldRefresh: string): Promise<Tokens> {
  // Verify signature/expiry first to avoid leaking info.
  let claims: { sub: string };
  try {
    claims = verifyRefresh<{ sub: string }>(oldRefresh);
  } catch {
    throw new AppError("Invalid refresh token", 401, {
      code: "REFRESH_INVALID",
    });
  }

  const hashed = hashRefresh(oldRefresh);
  const session = await prisma.session.findFirst({
    where: { token: hashed, valid: true },
    select: { id: true, userId: true },
  });

  // Reuse or stale token: revoke all active sessions for the user.
  if (!session) {
    if (claims?.sub) {
      await prisma.session.updateMany({
        where: { userId: claims.sub, valid: true }, // scalar equals (correct)
        data: { valid: false },
      });
    }
    throw new AppError("Refresh token reuse detected", 401, {
      code: "REFRESH_REUSE",
    });
  }

  // Rotate: invalidate the used session, issue new tokens, persist new session.
  await prisma.session.update({
    where: { id: session.id },
    data: { valid: false },
  });

  const accessToken = signAccess({ sub: session.userId });
  const newRefresh = signRefresh({ sub: session.userId });

  await prisma.session.create({
    data: {
      userId: session.userId,
      token: hashRefresh(newRefresh),
      valid: true,
    },
  });

  return { accessToken, refreshToken: newRefresh };
}

/**
 * Logout: invalidate the provided refresh token if it exists and is valid.
 */
export async function logout(refreshToken: string): Promise<void> {
  const hashed = hashRefresh(refreshToken);
  await prisma.session.updateMany({
    where: { token: hashed, valid: true },
    data: { valid: false },
  });
}
