/**
 * Prometheus metrics for the HTTP server.
 * - Collects default process metrics (CPU, memory, event loop lag)
 * - Records request counts and durations per method/route/status
 * - Exposes a handler to render metrics in Prometheus text format
 */

import * as client from "prom-client";

import type { Request, Response, NextFunction } from "express";

/** Collect default process metrics on a single (default) registry. */
client.collectDefaultMetrics();

/** Request counter: method/route/status_code labels. */
const httpRequestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
});

/** Request duration histogram in seconds: method/route/status_code labels. */
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  // Sane buckets for web latency: 5ms -> 5s
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

/**
 * Middleware that records request count and duration.
 * Uses the route path if available; falls back to req.path.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = process.hrtime.bigint();
  res.once("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = durationNs / 1e9;

    /**
     * When Express matches a route, req.route.path is relative to the router (e.g. "/login").
     * Include req.baseUrl so mounted routers (/auth) report correctly; otherwise fall back to req.path.
     */
    const routePath = typeof req.route?.path === "string" ? req.route.path : "";
    const rawUrl = req.originalUrl?.split("?")[0] ?? "";
    const derivedBase =
      routePath && rawUrl.endsWith(routePath)
        ? rawUrl.slice(0, rawUrl.length - routePath.length)
        : "";
    const base = derivedBase || req.baseUrl || "";
    const primaryRoute = routePath.length > 0 ? `${base}${routePath}` : undefined;
    const fallbackPath = req.path ?? rawUrl;
    const route = primaryRoute ?? fallbackPath ?? "unknown";
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestCounter.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });

  next();
}

/**
 * Handler that renders all metrics in Prometheus text format.
 * Exported for mounting at GET /metrics.
 */
export async function metricsHandler(_req: Request, res: Response) {
  res.setHeader("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}
