import { Router } from "express";

import { LoginSchema, RegisterSchema, RefreshSchema } from "../dto/auth.js";
import * as Auth from "../services/authService.js";

export const auth = Router();

// Register
auth.post("/register", async (req, res, next) => {
  try {
    const dto = RegisterSchema.parse(req.body);
    const t = await Auth.register(dto);
    res.status(201).json(t);
  } catch (err) {
    next(err);
  }
});

// Login
auth.post("/login", async (req, res, next) => {
  try {
    const dto = LoginSchema.parse(req.body);
    const t = await Auth.login(dto);
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
