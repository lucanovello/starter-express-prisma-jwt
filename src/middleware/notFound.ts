import type { RequestHandler } from "express";

/**
 * Not Found handler: final route handler for unmatched paths.
 * Always returns JSON 404 with a minimal error envelope.
 */
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: "Not Found" } });
};
