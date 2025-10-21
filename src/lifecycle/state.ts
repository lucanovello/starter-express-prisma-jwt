/**
 * Process lifecycle state shared across the app.
 * Tracks whether the server has begun graceful shutdown.
 */
let shuttingDown = false;

/** Returns true if the process has begun graceful shutdown. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Marks the process as shutting down (read by readiness checks). */
export function beginShutdown(): void {
  shuttingDown = true;
}
