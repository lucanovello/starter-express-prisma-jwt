/**
 * Application entrypoint.
 * Middleware order:
 * 1) express.json()  — parse JSON
 * 2) (security middleware goes here in next step)
 * 3) routes          — e.g., /health
 * 4) notFound        — 404 JSON
 * 5) errorHandler    — global JSON errors (must be last)
 */
import express from "express";
import dotenv from "dotenv";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./lib/errors.js";
import { registerSecurity } from "./middleware/security.js";
import { auth as authRoutes } from "./routes/auth.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
registerSecurity(app);

app.use("/auth", authRoutes);

app.get("/health", (req, res, next) => {
  res.status(200).json({ status: "ok" });
});

app.get("/test/app-error", (req, res, next) => {
  next(new AppError("This is a test AppError"));
});

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port http://localhost:${port}`);
});
