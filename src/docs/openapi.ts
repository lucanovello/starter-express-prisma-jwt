/**
 * OpenAPI 3.1 document generated from Zod DTOs.
 * This keeps the API docs aligned with the runtime validators.
 *
 * Notes:
 * - DTOs are imported from ../dto/auth.js (ESM + .js convention).
 * - The document is generated at import time and exported as the default export,
 *   so existing app wiring (`/openapi.json`, `/docs`) doesn't change.
 */

import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

// Enable .openapi() on Zod schemas for registration and metadata
extendZodWithOpenApi(z);

// Import Zod DTOs used by the auth routes.
// Adjust names here only if your DTO names differ.
import { RegisterSchema, LoginSchema, RefreshSchema } from "../dto/auth.js";

// Create a registry to collect schemas and paths.
const registry = new OpenAPIRegistry();

/** Common error envelope used across endpoints. */
const ErrorSchema = z.object({
  code: z.string().optional(),
  message: z.string(),
  details: z.any().optional(),
});
registry.register("Error", ErrorSchema);

/** Token pair returned by auth endpoints. */
const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
registry.register("Tokens", TokensSchema);

// ----- Paths: health & readiness (probes) -----

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Liveness probe",
  responses: {
    200: {
      description: "Process is up",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/ready",
  summary: "Readiness probe",
  responses: {
    200: {
      description: "DB reachable",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ready"),
          }),
        },
      },
    },
    503: {
      description: "Not ready",
      content: {
        "application/json": {
          schema: z.object({
            error: ErrorSchema,
          }),
        },
      },
    },
  },
});

// ----- Paths: auth -----

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Register a new user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Created. Returns access and refresh tokens.",
      content: {
        "application/json": {
          schema: TokensSchema,
        },
      },
    },
    409: {
      description: "Email already taken",
      content: {
        "application/json": {
          schema: z.object({ error: ErrorSchema }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login with credentials",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Authenticated. Returns access and refresh tokens.",
      content: {
        "application/json": {
          schema: TokensSchema,
        },
      },
    },
    401: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: z.object({ error: ErrorSchema }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Rotate refresh token",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RefreshSchema, // expects a refreshToken
        },
      },
    },
  },
  responses: {
    200: {
      description: "New access & refresh tokens issued",
      content: {
        "application/json": {
          schema: TokensSchema,
        },
      },
    },
    401: {
      description: "Invalid or reused refresh token",
      content: {
        "application/json": {
          schema: z.object({ error: ErrorSchema }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Invalidate a refresh token (logout)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            refreshToken: z.string().min(20),
          }),
        },
      },
    },
  },
  responses: {
    204: {
      description: "Logged out",
    },
  },
});

// ----- Generate and export the document (keep default export) -----

const generator = new OpenApiGeneratorV31(registry.definitions);

const openapi = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Starter Express Prisma JWT",
    version: "1.0.0",
    description:
      "OpenAPI document generated from Zod schemas using @asteasolutions/zod-to-openapi.",
  },
  servers: [{ url: "/" }],
});

export default openapi;
