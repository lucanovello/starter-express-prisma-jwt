import type { ErrorRequestHandler } from "express";
import type { ErrorResponse } from "../types/http.js";
import { AppError } from "../lib/errors.js";

const isProd = process.env.NODE_ENV === "production";

/**
 * Global JSON error handler (must be registered last).
 *
 * Behavior:
 * - Maps invalid JSON body (SyntaxError from express.json()) → 400 "Invalid JSON".
 * - Formats AppError → uses its statusCode/message/code.
 * - Falls back to 500 "Internal Server Error" for unknown errors.
 * - Hides stacks/extra details in production (NODE_ENV=production).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  const isInvalidJson =
    err instanceof SyntaxError &&
    ((err as any).type === "entity.parse.failed" ||
      (err as any).status === 400);

  const isAppError = err instanceof AppError;

  let status = 500;
  let message = "Internal Server Error";
  let code: string | undefined;
  // keep a hook for opt-in diagnostics (non-prod)
  let details: unknown;

  if (isInvalidJson) {
    status = 400;
    message = "Invalid JSON";
  } else if (isAppError) {
    status = err.statusCode || 400;
    message = err.message || "Bad Request";
    code = err.code;
  } else if (
    typeof err?.status === "number" ||
    typeof err?.statusCode === "number"
  ) {
    status = err.status ?? err.statusCode ?? status;
    message = err.message || message;
  }

  const body: ErrorResponse = { error: { message } };
  if (code) body.error.code = code;
  if (!isProd && details !== undefined) body.error.details = details;

  res.status(status).json(body);
};
