import { Router } from "express";
import { LoginSchema, RegisterSchema, RefreshSchema } from "../dto/auth.js";
import { login, refresh, logout, register } from "../services/authService.js";

export const auth = Router();

// Register
auth.post("/register", async (req, res, next) => {
  try {
    const dto = RegisterSchema.parse(req.body);
    const t = await register(dto);
    res.json(t);
  } catch (e) {
    next(e);
  }
});

// Login
auth.post("/login", async (req, res, next) => {
  try {
    const dto = LoginSchema.parse(req.body);
    const t = await login(dto);
    res.json(t);
  } catch (e) {
    next(e);
  }
});

// Token refresh
auth.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    const t = await refresh(refreshToken);
    res.json(t);
  } catch (e) {
    next(e);
  }
});

// Logout
auth.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = RefreshSchema.parse(req.body);
    await logout(refreshToken);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
