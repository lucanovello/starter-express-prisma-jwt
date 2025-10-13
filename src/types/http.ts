/**
 * Standard error envelope returned by the API.
 * Keep this minimal to avoid leaking internals.
 */
export type ErrorResponse = {
  error: { message: string; code?: string; details?: unknown };
};
