/**
 * OpenAPI 3.1 document generated from Zod DTOs.
 * Aligns HTTP docs with the runtime validators to prevent drift.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
} from "../dto/auth.js";

const registry = new OpenAPIRegistry();

const Tags = {
  Operational: "Operational",
  Metrics: "Metrics",
  Auth: "Auth",
  Sessions: "Sessions",
  RBAC: "RBAC",
} as const;

const ErrorSchema = z
  .object({
    message: z.string().openapi({ example: "Unauthorized" }),
    code: z
      .string()
      .optional()
      .openapi({ example: "UNAUTHORIZED", description: "Machine-readable error code when present." }),
    details: z
      .unknown()
      .optional()
      .openapi({ description: "Optional structured details (validation issues, etc.)." }),
  })
  .openapi("Error", {
    description: "Standard error payload included in the `error` envelope.",
  });
registry.register("Error", ErrorSchema);

const ErrorResponseSchema = z
  .object({ error: ErrorSchema })
  .openapi("ErrorResponse", {
    description: "Error response envelope shared by all endpoints.",
  });
registry.register("ErrorResponse", ErrorResponseSchema);

const makeErrorResponse = (
  description: string,
  example: { message: string; code?: string; details?: unknown },
) => ({
  description,
  content: {
    "application/json": {
      schema: ErrorResponseSchema,
      example: { error: example },
    },
  },
});

const errorResponse = makeErrorResponse;

const validationErrorResponse = errorResponse("Invalid request payload", {
  message: "Invalid request payload",
  code: "VALIDATION",
  details: [
    {
      path: ["field"],
      code: "invalid_type",
      message: "Expected string, received null",
    },
  ],
});

const unauthorizedResponse = errorResponse("Missing or invalid bearer token", {
  message: "Unauthorized",
  code: "UNAUTHORIZED",
});

const forbiddenResponse = errorResponse("Authenticated but lacking required role", {
  message: "Forbidden",
  code: "FORBIDDEN",
});

const emailTakenResponse = errorResponse("Email already registered", {
  message: "Email already registered",
  code: "EMAIL_TAKEN",
});

const invalidCredentialsResponse = errorResponse("Invalid credentials", {
  message: "Invalid credentials",
  code: "INVALID_CREDENTIALS",
});

const refreshRequiredResponse = errorResponse("Refresh token missing", {
  message: "Refresh token required",
  code: "REFRESH_REQUIRED",
});

const metricsForbiddenResponse = errorResponse("Caller not allowed to access metrics", {
  message: "Metrics access forbidden",
  code: "METRICS_GUARD_FORBIDDEN",
});

const userNotFoundResponse = errorResponse("Requested user does not exist", {
  message: "User not found",
  code: "USER_NOT_FOUND",
});

const StatusOkSchema = z
  .object({ status: z.literal("ok") })
  .openapi("StatusOk", {
    example: { status: "ok" },
    description: "Simple OK response used by liveness and ping endpoints.",
  });
registry.register("StatusOk", StatusOkSchema);

const ReadySchema = z
  .object({ status: z.literal("ready") })
  .openapi("StatusReady", {
    example: { status: "ready" },
    description: "Readiness probe response when dependencies are healthy.",
  });
registry.register("StatusReady", ReadySchema);

const VersionSchema = z
  .object({
    version: z.string().openapi({
      example: "1.0.0",
      description: "Semantic version assigned at build time.",
    }),
    gitSha: z.string().openapi({
      example: "8b4c1de7",
      description: "Short Git SHA recorded during the build.",
    }),
    buildTime: z
      .string()
      .openapi({ example: "2025-01-15T12:34:56.000Z", description: "ISO-8601 build timestamp." }),
  })
  .openapi("VersionResponse");
registry.register("VersionResponse", VersionSchema);

const TokenPairSchema = z
  .object({
    accessToken: z
      .string()
      .min(20)
      .openapi({
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token-placeholder",
        description: "JWT access token to supply in the Authorization header.",
      }),
    refreshToken: z
      .string()
      .min(20)
      .openapi({
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token-placeholder",
        description: "Rotating refresh token used to mint new access tokens.",
      }),
  })
  .openapi("TokenPair", {
    description: "Tokens returned after a successful login or refresh.",
  });
registry.register("TokenPair", TokenPairSchema);

const RegisterResponseSchema = z
  .object({
    emailVerificationRequired: z
      .boolean()
      .openapi({
        example: false,
        description:
          "Indicates whether the user must verify their email before tokens are issued.",
      }),
    accessToken: TokenPairSchema.shape.accessToken.optional(),
    refreshToken: TokenPairSchema.shape.refreshToken.optional(),
  })
  .openapi("RegisterResponse", {
    description:
      "Response returned after registration. Tokens are omitted when email verification is required.",
    example: {
      emailVerificationRequired: false,
      accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token-placeholder",
      refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token-placeholder",
    },
  });
registry.register("RegisterResponse", RegisterResponseSchema);

const RequestAcceptedSchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("AcceptedResponse", {
    description: "Acknowledgement response for asynchronous background actions.",
    example: { status: "ok" },
  });
registry.register("AcceptedResponse", RequestAcceptedSchema);

const RoleSchema = z.enum(["USER", "ADMIN"]).openapi("Role", {
  example: "ADMIN",
  description: "Application role associated with the authenticated user.",
});
registry.register("Role", RoleSchema);

const SessionSummarySchema = z
  .object({
    id: z.string().uuid().openapi({ example: "746b96ac-983d-4b65-96a2-1e727caa0027" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-15T12:34:56.000Z", description: "Session creation timestamp." }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2025-01-16T08:12:04.000Z", description: "Last refresh timestamp." }),
    valid: z.boolean().openapi({ example: true }),
    current: z
      .boolean()
      .openapi({ example: false, description: "True when this session matches the caller token." }),
  })
  .openapi("SessionSummary", {
    description: "Minimal session metadata returned from the sessions endpoint.",
  });
registry.register("SessionSummary", SessionSummarySchema);

const SessionsResponseSchema = z
  .object({
    sessions: z.array(SessionSummarySchema),
    count: z.number().int().nonnegative().openapi({ example: 2 }),
  })
  .openapi("SessionsResponse", {
    description: "Paginated session listing (currently single-page).",
    example: {
      count: 1,
      sessions: [
        {
          id: "746b96ac-983d-4b65-96a2-1e727caa0027",
          createdAt: "2025-01-15T12:34:56.000Z",
          updatedAt: "2025-01-16T08:12:04.000Z",
          valid: true,
          current: true,
        },
      ],
    },
  });
registry.register("SessionsResponse", SessionsResponseSchema);

const UserSummarySchema = z
  .object({
    id: z.string().uuid().openapi({ example: "0c853481-6d5f-4205-8b51-7c0dcbf1bba1" }),
    email: z.string().email().openapi({ example: "user@example.com" }),
    role: RoleSchema,
  })
  .openapi("UserSummary", {
    description: "Minimal user profile payload returned when accessing protected resources.",
  });
registry.register("UserSummary", UserSummarySchema);

const ProtectedUserResponseSchema = z
  .object({
    user: UserSummarySchema,
    owner: z
      .boolean()
      .openapi({ example: true, description: "True when the requester is accessing their own user." }),
  })
  .openapi("ProtectedUserResponse", {
    description: "Response returned when reading a protected user resource.",
  });
registry.register("ProtectedUserResponse", ProtectedUserResponseSchema);

const MetricsTextSchema = z
  .string()
  .openapi("PrometheusMetrics", {
    example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/health",status_code="200"} 1`,
    description: "Prometheus exposition format payload.",
  });
registry.register("PrometheusMetrics", MetricsTextSchema);

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "Send the access token obtained during login or refresh as `Authorization: Bearer <token>`.",
});

registry.registerComponent("securitySchemes", "MetricsSecret", {
  type: "apiKey",
  in: "header",
  name: "x-metrics-secret",
  description:
    "When the metrics guard is configured for shared-secret mode, supply the configured secret.",
});

// ----- Paths: Health & metadata -----

registry.registerPath({
  method: "get",
  path: "/health",
  summary: "Liveness probe",
  description: "Returns HTTP 200 when the process is running and able to serve traffic.",
  tags: [Tags.Operational],
  operationId: "getHealth",
  responses: {
    200: {
      description: "Process is healthy.",
      content: { "application/json": { schema: StatusOkSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/ready",
  summary: "Readiness probe",
  description:
    "Indicates whether downstream dependencies (database, etc.) are reachable. Load balancers should poll this endpoint.",
  tags: [Tags.Operational],
  operationId: "getReadiness",
  responses: {
    200: {
      description: "Application is ready to receive traffic.",
      content: { "application/json": { schema: ReadySchema } },
    },
    503: {
      description: "Service not yet ready to receive traffic.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            shuttingDown: {
              summary: "Graceful shutdown in progress",
              value: { error: { message: "Shutting down", code: "SHUTTING_DOWN" } },
            },
            dependency: {
              summary: "Dependency not ready",
              value: { error: { message: "Not Ready", code: "NOT_READY" } },
            },
            redisUnavailable: {
              summary: "Redis dependency not ready",
              value: { error: { message: "Redis not ready", code: "REDIS_NOT_READY" } },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/version",
  summary: "Build metadata",
  description:
    "Exposes the version, Git SHA, and build timestamp baked into the running artifact. Useful for debugging and release traceability.",
  tags: [Tags.Operational],
  operationId: "getVersion",
  responses: {
    200: {
      description: "Build metadata for the running instance.",
      content: {
        "application/json": {
          schema: VersionSchema,
        },
      },
    },
  },
});

// ----- Paths: Metrics -----

registry.registerPath({
  method: "get",
  path: "/metrics",
  summary: "Prometheus metrics",
  description:
    "Prometheus exposition endpoint protected by environment-configurable guards. In production this endpoint must be secured via CIDR or secret gate.",
  tags: [Tags.Metrics],
  operationId: "getMetrics",
  security: [{ MetricsSecret: [] }],
  responses: {
    200: {
      description: "Prometheus text payload.",
      content: {
        "text/plain": {
          schema: MetricsTextSchema,
        },
      },
    },
    401: {
      description: "Missing or invalid metrics secret header.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            missing: {
              summary: "Secret header missing",
              value: { error: { message: "Missing or invalid metrics secret", code: "METRICS_GUARD_MISSING" } },
            },
            invalid: {
              summary: "Secret header incorrect",
              value: { error: { message: "Missing or invalid metrics secret", code: "METRICS_GUARD_INVALID" } },
            },
          },
        },
      },
    },
    403: metricsForbiddenResponse,
  },
});

// ----- Paths: Auth lifecycle -----

registry.registerPath({
  method: "post",
  path: "/auth/register",
  summary: "Register a new user",
  description:
    "Creates a user account. Depending on configuration, tokens may be returned immediately or after email verification.",
  tags: [Tags.Auth],
  operationId: "registerUser",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RegisterSchema,
          example: {
            email: "new.user@example.com",
            password: "Sup3rSecure!1",
          },
        },
      },
    },
  },
  responses: {
    201: {
      description: "User created.",
      content: {
        "application/json": {
          schema: RegisterResponseSchema,
        },
      },
    },
    400: validationErrorResponse,
    409: emailTakenResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  summary: "Login with credentials",
  description:
    "Validates user credentials and returns a fresh access/refresh token pair. Login attempts are rate limited and tracked per IP and email.",
  tags: [Tags.Auth],
  operationId: "loginUser",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: LoginSchema,
          example: {
            email: "new.user@example.com",
            password: "Sup3rSecure!1",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Authentication succeeded.",
      content: {
        "application/json": {
          schema: TokenPairSchema,
        },
      },
    },
    400: validationErrorResponse,
    401: invalidCredentialsResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  summary: "Rotate refresh token",
  description:
    "Exchanges a valid refresh token for a new access/refresh token pair. Reuses invalidate the entire session family.",
  tags: [Tags.Auth],
  operationId: "refreshTokens",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RefreshSchema,
          example: {
            refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token-placeholder",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "New tokens issued.",
      content: {
        "application/json": {
          schema: TokenPairSchema,
        },
      },
    },
    400: refreshRequiredResponse,
    401: {
      description: "Refresh token invalid, expired, or reused.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            sessionInvalid: {
              summary: "Session no longer valid",
              value: { error: { message: "Invalid session", code: "SESSION_INVALID" } },
            },
            refreshReuse: {
              summary: "Refresh token reuse detected",
              value: { error: { message: "Invalid token", code: "REFRESH_REUSE" } },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  summary: "Invalidate refresh token",
  description:
    "Accepts the current refresh token and revokes the backing session. The operation is idempotent.",
  tags: [Tags.Auth],
  operationId: "logoutSession",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RefreshSchema,
          example: {
            refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token-placeholder",
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Session revoked (or token already invalid).",
    },
    400: validationErrorResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify-email",
  summary: "Confirm email address",
  description:
    "Marks the user as verified using the token sent via email. Existing sessions remain valid after verification.",
  tags: [Tags.Auth],
  operationId: "verifyEmail",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: VerifyEmailSchema,
          example: {
            token: "verify-token-placeholder",
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Email verified.",
    },
    400: {
      description: "Invalid payload or verification token.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            validation: {
              summary: "Payload validation failure",
              value: validationErrorResponse.content["application/json"].example,
            },
            invalidToken: {
              summary: "Token not found or already used",
              value: { error: { message: "Invalid verification token", code: "EMAIL_VERIFICATION_INVALID" } },
            },
            expiredToken: {
              summary: "Token expired",
              value: { error: { message: "Verification token expired", code: "EMAIL_VERIFICATION_EXPIRED" } },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/request-password-reset",
  summary: "Request password reset",
  description:
    "Queues an email with password reset instructions. Always returns 202 to avoid leaking account existence.",
  tags: [Tags.Auth],
  operationId: "requestPasswordReset",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RequestPasswordResetSchema,
          example: {
            email: "user@example.com",
          },
        },
      },
    },
  },
  responses: {
    202: {
      description: "Reset link queued (or request ignored).",
      content: {
        "application/json": {
          schema: RequestAcceptedSchema,
        },
      },
    },
    400: validationErrorResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/reset-password",
  summary: "Reset password",
  description:
    "Uses a password reset token to set a new password. All sessions are revoked once the password is changed.",
  tags: [Tags.Auth],
  operationId: "resetPassword",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ResetPasswordSchema,
          example: {
            token: "reset-token-placeholder",
            password: "NewSup3rSecure!1",
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Password updated.",
    },
    400: {
      description: "Invalid payload or reset token.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            validation: {
              summary: "Payload validation failure",
              value: validationErrorResponse.content["application/json"].example,
            },
            invalidToken: {
              summary: "Reset token invalid or already used",
              value: { error: { message: "Invalid reset token", code: "PASSWORD_RESET_INVALID" } },
            },
            expiredToken: {
              summary: "Reset token expired",
              value: { error: { message: "Reset token expired", code: "PASSWORD_RESET_EXPIRED" } },
            },
          },
        },
      },
    },
  },
});

// ----- Paths: Session management -----

registry.registerPath({
  method: "get",
  path: "/auth/sessions",
  summary: "List sessions",
  description:
    "Lists active and historical sessions for the authenticated user. The current session is flagged for easier UX.",
  tags: [Tags.Sessions],
  operationId: "listSessions",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Session listing.",
      content: {
        "application/json": {
          schema: SessionsResponseSchema,
        },
      },
    },
    401: unauthorizedResponse,
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout-all",
  summary: "Logout all sessions",
  description: "Revokes every session for the authenticated user.",
  tags: [Tags.Sessions],
  operationId: "logoutAllSessions",
  security: [{ BearerAuth: [] }],
  responses: {
    204: { description: "All sessions revoked." },
    401: unauthorizedResponse,
  },
});

// ----- Paths: RBAC-protected resources -----

registry.registerPath({
  method: "get",
  path: "/protected/admin/ping",
  summary: "Admin ping",
  description:
    "Simple RBAC-protected endpoint to validate that admin-only routes are correctly secured.",
  tags: [Tags.RBAC],
  operationId: "adminPing",
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: "Admin-only ping succeeded.",
      content: {
        "application/json": {
          schema: StatusOkSchema,
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
  },
});

registry.registerPath({
  method: "get",
  path: "/protected/users/{userId}",
  summary: "Get user profile",
  description:
    "Returns limited user details. Only the owner or an ADMIN role may access the resource.",
  tags: [Tags.RBAC],
  operationId: "getProtectedUser",
  security: [{ BearerAuth: [] }],
  request: {
    params: z
      .object({
        userId: z
          .string()
          .uuid()
          .openapi({ example: "0c853481-6d5f-4205-8b51-7c0dcbf1bba1", description: "User ID." }),
      })
      .openapi("GetProtectedUserParams"),
  },
  responses: {
    200: {
      description: "User resource located.",
      content: {
        "application/json": {
          schema: ProtectedUserResponseSchema,
        },
      },
    },
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: userNotFoundResponse,
  },
});

const generator = new OpenApiGeneratorV31(registry.definitions);

const openapi = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Starter Express Prisma JWT",
    version: "1.0.0",
    description: [
      "OpenAPI document generated from shared Zod schemas to guarantee parity between validation and documentation.",
      "",
      "Versioning policy: the API is currently served under `/` (v1). Consumers should target `/v1` when exposed via a gateway and expect all breaking changes to ship under a new `/v{n}` prefix.",
    ].join("\n"),
    contact: {
      name: "Platform Team",
      url: "https://github.com/lucanovello/starter-express-prisma-jwt",
    },
  },
  servers: [
    { url: "/", description: "Default base path (v1)." },
    { url: "/v1", description: "Recommended reverse-proxy mount for stable clients." },
  ],
});

openapi.tags = [
  { name: Tags.Operational, description: "Health checks and platform metadata." },
  { name: Tags.Metrics, description: "Observability endpoints secured by config." },
  { name: Tags.Auth, description: "Authentication lifecycle endpoints." },
  { name: Tags.Sessions, description: "Session management for authenticated users." },
  { name: Tags.RBAC, description: "Role-gated resources and authorization flows." },
];

openapi["x-tagGroups"] = [
  { name: "Platform", tags: [Tags.Operational, Tags.Metrics] },
  { name: "Identity", tags: [Tags.Auth, Tags.Sessions, Tags.RBAC] },
];

export default openapi;
