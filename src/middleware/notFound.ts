import { Request, Response } from "express";

/**
 * Not Found handler: final route handler for unmatched paths.
 * Always returns JSON 404 with a minimal error envelope.
 * @param req Express request
 * @param res Express response
 * @returns Sends `{ "error": { "message": "Not Found" } }` with status 404
 */
export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: { message: "Not Found" } });
}
