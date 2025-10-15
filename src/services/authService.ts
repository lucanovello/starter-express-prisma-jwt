import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { verifyPassword } from "../lib/password.js";
import { hashRefresh } from "../lib/tokenHash.js";

export type LoginDTO = { email: string; password: string };
export type Tokens = { accessToken: string; refreshToken: string };

export async function login({ email, password }: LoginDTO): Promise<Tokens> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user)
    throw new AppError("Invalid credentials", 401, { code: "BAD_CREDENTIALS" });
  const ok = await verifyPassword(user.password, password);
  if (!ok)
    throw new AppError("Invalid credentials", 401, { code: "BAD_CREDENTIALS" });

  const accessToken = signAccess({ sub: user.id });
  const refreshToken = signRefresh({ sub: user.id });
  await prisma.session.create({
    data: { userId: user.id, token: hashRefresh(refreshToken), valid: true },
  });
  return { accessToken, refreshToken };
}

export async function refresh(oldRefresh: string): Promise<Tokens> {
  let claims: any;
  try {
    claims = verifyRefresh(oldRefresh);
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

  // reuse or stale: revoke all sessions for user (if known)
  if (!session) {
    if (claims?.sub)
      await prisma.session.updateMany({
        where: { userId: claims.sub, valid: true },
        data: { valid: false },
      });
    throw new AppError("Invalid refresh token", 401, { code: "REFRESH_REUSE" });
  }

  // rotate
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

export async function logout(refreshToken: string): Promise<void> {
  const hashed = hashRefresh(refreshToken);
  await prisma.session.updateMany({
    where: { token: hashed, valid: true },
    data: { valid: false },
  });
}
