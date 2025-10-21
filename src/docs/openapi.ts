/**
 * OpenAPI 3.1.0 specification for the Starter Express Prisma JWT API.
 */
const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Starter Express Prisma JWT",
    version: "1.0.0",
    description:
      "Initial API specification. DTO-backed schemas will be adopted via zod-to-openapi in a subsequent PR.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        responses: {
          "200": {
            description: "Process is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", enum: ["ok"] } },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness probe",
        responses: {
          "200": {
            description: "DB reachable",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", enum: ["ready"] } },
                  required: ["status"],
                },
              },
            },
          },
          "503": {
            description: "Not ready",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "object",
                      properties: {
                        message: { type: "string" },
                        code: { type: "string" },
                      },
                      required: ["message"],
                    },
                  },
                  required: ["error"],
                },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Register",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Tokens",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Tokens" },
              },
            },
          },
          "409": { description: "Email taken" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Tokens",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Tokens" },
              },
            },
          },
          "401": { description: "Bad credentials" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Rotate refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refreshToken: { type: "string", minLength: 20 } },
                required: ["refreshToken"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "New tokens",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Tokens" },
              },
            },
          },
          "401": { description: "Invalid or reused token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Invalidate a refresh token (logout)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refreshToken: { type: "string", minLength: 20 } },
                required: ["refreshToken"],
              },
            },
          },
        },
        responses: { "204": { description: "Logged out" } },
      },
    },
  },
  components: {
    schemas: {
      Tokens: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
        required: ["accessToken", "refreshToken"],
      },
    },
  },
} as const;

export default openapi;
