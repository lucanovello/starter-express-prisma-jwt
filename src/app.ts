/**
 * App composition (no .listen() here).
 * WHY: Tests import the app directly (Supertest) without opening a TCP port.
 */
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import crypto from "node:crypto";
import pino from "pino";
import pinoHttp, { type Options } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import swaggerUi from "swagger-ui-express";
import openapi from "./docs/openapi.js";

import { registerSecurity } from "./middleware/security.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { auth as authRoutes } from "./routes/auth.js";
import { prisma } from "./lib/prisma.js";

const app = express();

// Structured logging with request correlation.
const logger = pino(
  process.env.NODE_ENV === "production"
    ? {}
    : { transport: { target: "pino-pretty" } }
);

// pino-http is typed at the Node http layer.
// Keep these hooks on IncomingMessage/ServerResponse,
// and bridge to Express types only where needed.
const pinoOptions: Options<IncomingMessage, ServerResponse<IncomingMessage>> = {
  logger,
  genReqId: (req) =>
    (req.headers["x-request-id"] as string) || crypto.randomUUID(),
  customProps: (_req, res) => {
    // Express adds res.locals; not present on ServerResponse types.
    const anyRes = res as unknown as { locals?: Record<string, unknown> };
    return { userId: anyRes.locals?.userId };
  },
};

// Some installs surface pinoHttp’s type as a module object.
// Cast once to a callable Express RequestHandler factory.
const pinoHttpFn = pinoHttp as unknown as (
  opts: typeof pinoOptions
) => RequestHandler;

app.use(pinoHttpFn(pinoOptions));

// Echo the id to clients so they can reference it in bug reports, etc.
const echoRequestId: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // pino-http attaches `req.id` as string | number
  const id = (req as unknown as { id?: string | number }).id;
  if (id != null) res.setHeader("x-request-id", String(id));
  next();
};
app.use(echoRequestId);

// express.json() needs a cast for Express 5 + connect-style types.
const jsonParser = express.json() as unknown as RequestHandler;
app.use(jsonParser);

// Security baseline (helmet, CORS, rate limit, etc.)
registerSecurity(app);

// Liveness: process is up and serving HTTP
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Readiness: dependencies (DB) respond
app.get("/ready", async (_req: Request, res: Response) => {
  try {
    // Cheap DB ping — succeeds if the DB is reachable
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch {
    res
      .status(503)
      .json({ error: { message: "Not Ready", code: "NOT_READY" } });
  }
});

// Feature routes
app.use("/auth", authRoutes);

// API docs
// Serve OpenAPI spec as JSON
app.get("/openapi.json", (_req, res) => res.json(openapi));

// Serve Swagger UI only in non-production environments
if (process.env.NODE_ENV !== "production") {
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));
}

// 404 + error pipeline
app.use(notFound);
app.use(errorHandler);

export default app;
