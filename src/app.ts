/**
 * App composition (no .listen() here).
 * WHY: Tests import the app directly (Supertest) without opening a TCP port.
 */
import express from "express";
import { registerSecurity } from "./middleware/security.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
// Ensure you have a router file that exports `auth`:
import { auth as authRoutes } from "./routes/auth.js";

const app = express();

app.use(express.json());

// Security baseline (helmet, cors, rate limit, etc.)
registerSecurity(app);

// Stable health oracle for tests/ops
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Feature routes
app.use("/auth", authRoutes);

// 404 + error pipeline
app.use(notFound);
app.use(errorHandler);

export default app;
