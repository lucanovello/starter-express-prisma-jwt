/**
 * Global JSON error handler (must be registered last).
 *
 * Behavior:
 * - ZodError -> 400 "Invalid request payload" (+ issues in non-prod).
 * - Invalid JSON (from express.json) -> 400 "Invalid JSON".
 * - AppError -> status/message/code from the error.
 * - Unknown -> 500 "Internal Server Error".
 */
import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";

import type { ErrorResponse } from "../types/http.js";
import type { ErrorRequestHandler } from "express";

const isProd = process.env.NODE_ENV === "production";

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  // 1) Validation errors from Zod -> 400 with stable envelope
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      error: { message: "Invalid request payload", code: "VALIDATION" },
    };
    if (!isProd) body.error.details = err.issues;
    return res.status(400).json(body);
  }

  // 2) Malformed JSON body
  const isInvalidJson =
    err instanceof SyntaxError &&
    ((err as any).type === "entity.parse.failed" ||
      (err as any).status === 400);

  if (isInvalidJson) {
    const body: ErrorResponse = { error: { message: "Invalid JSON" } };
    return res.status(400).json(body);
  }

  // 3) Domain errors
  if (err instanceof AppError) {
    const status = err.statusCode || 400;
    const expose = err.expose ?? status < 500;
    const message = expose
      ? err.message || "Bad Request"
      : status >= 500
        ? "Internal Server Error"
        : "Bad Request";
    const body: ErrorResponse = {
      error: { message },
    };
    if (expose && err.code) body.error.code = err.code;
    return res.status(status).json(body);
  }

  // 4) Generic HTTP-ish errors with status/statusCode
  if (typeof err?.status === "number" || typeof err?.statusCode === "number") {
    const status = (err.status ?? err.statusCode) as number;
    const body: ErrorResponse = {
      error: { message: err?.message || "Error" },
    };
    return res.status(status).json(body);
  }

  // 5) Fallback
  const body: ErrorResponse = { error: { message: "Internal Server Error" } };
  return res.status(500).json(body);
};
