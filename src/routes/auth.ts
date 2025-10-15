import { Router } from "express";
export const auth = Router();
auth.post("/register", (_req, res) =>
  res.status(501).json({ error: { message: "Not implemented" } })
);
auth.post("/login", (_req, res) =>
  res.status(501).json({ error: { message: "Not implemented" } })
);
auth.post("/refresh", (_req, res) =>
  res.status(501).json({ error: { message: "Not implemented" } })
);
auth.post("/logout", (_req, res) =>
  res.status(501).json({ error: { message: "Not implemented" } })
);
