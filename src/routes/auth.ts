import { Router } from "express";
import { z } from "zod";
import { login, refresh, logout } from "../services/authService.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const RefreshSchema = z.object({ refreshToken: z.string().min(20) });

export const auth = Router();

auth.post("/login", async (req, res, next) => {
  try {
    const dto = LoginSchema.parse(req.body);
    const t = await login(dto);
    res.json(t);
  } catch (e) {
    next(e);
  }
});
auth.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const t = await refresh(refreshToken);
    res.json(t);
  } catch (e) {
    next(e);
  }
});
auth.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    await logout(refreshToken);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
