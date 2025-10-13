/**
 * AppError: use for intentional HTTP errors in controllers/services.
 * - Carries an HTTP status (e.g., 400/401/403/404).
 * - Optional `code` for machine-readable error categorization.
 * - `expose` indicates whether the message is safe for clients (defaults true for 4xx).
 */
export class AppError extends Error {
  statusCode: number;
  code?: string;
  expose?: boolean;

  /**
   * Create a new AppError.
   * @param message Human-friendly error message.
   * @param statusCode HTTP status to return (defaults to 400).
   * @param options Optional metadata.
   * @param options.code Optional short machine code (e.g., "MISSING_BODY").
   * @param options.expose If false, the errorHandler may replace message (hide internals).
   */
  constructor(
    message: string,
    statusCode = 400,
    options?: { code?: string; expose?: boolean }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = options?.code;
    this.expose = options?.expose ?? true;
  }
}
