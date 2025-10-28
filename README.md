# Starter: Express + Prisma + JWT

[![CI](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml)

Minimal, batteries-included REST starter:

- Auth: access/refresh JWT + rotation
- Prisma/Postgres sessions
- Pino logs with `x-request-id`
- Liveness `/health` and readiness `/ready`
- CI: Vitest + coverage artifact

## Quickstart (local dev)

```bash
cp .env.example .env
docker compose up -d db
npm i
npx prisma generate
npx prisma migrate deploy
npm run dev
# (Ensure you're using Node 20.x)
# GET http://localhost:3000/health -> {"status":"ok"}
```

## Test

```bash
npm test
npm run test:cov  # uploads lcov artifact in CI
```

## Health

- `GET /health` → `200 {"status":"ok"}`
- `GET /ready` → `200 {"status":"ready"}` when DB responds, else `503 {"error":{"message":"Not Ready","code":"NOT_READY"}}`

## Env

| Name | Example | Notes |
| --- | --- | --- |
| DATABASE_URL | postgres://user:pass@host:5432/starter?schema=public | Postgres DSN |
| JWT_ACCESS_SECRET | dev-access | required |
| JWT_REFRESH_SECRET | dev-refresh | required |
| JWT_ACCESS_EXPIRY | 15m | default 15m |
| JWT_REFRESH_EXPIRY | 7d | default 7d |
| PORT | 3000 | optional |
| CORS_ORIGINS | https://app.example.com | comma-separated allowlist, required in production |
| RATE_LIMIT_REDIS_URL | redis://cache:6379 | required in production |
| AUTH_EMAIL_VERIFICATION_REQUIRED | false | defaults to false; when true, new sign-ins require verified email |
| AUTH_EMAIL_VERIFICATION_TTL_MINUTES | 60 | TTL for verification tokens (minutes) |
| AUTH_PASSWORD_RESET_TTL_MINUTES | 30 | TTL for password reset tokens (minutes) |
| AUTH_LOGIN_MAX_ATTEMPTS | 5 | Maximum failed logins per IP/email before lockout |
| AUTH_LOGIN_LOCKOUT_MINUTES | 15 | Lockout duration (minutes) |
| AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES | 15 | Rolling window for counting login attempts (minutes) |
| REQUEST_BODY_LIMIT | 100kb | optional override for express.json() |
| HTTP_SERVER_REQUEST_TIMEOUT_MS | 30000 | optional override, default 30s |
| HTTP_SERVER_HEADERS_TIMEOUT_MS | 60000 | optional override, default 60s |
| HTTP_SERVER_KEEPALIVE_TIMEOUT_MS | 5000 | optional override, default 5s |

## Run in Docker (prod-like)

```bash
docker build -t starter-api .
docker run --rm -p 3000:3000   -e DATABASE_URL=postgres://...   -e JWT_ACCESS_SECRET=...   -e JWT_REFRESH_SECRET=...   starter-api
```

## API docs

- Swagger UI: `GET /docs` (non-production)
- Raw spec: `GET /openapi.json` (all environments)

## CORS

- Production requires `CORS_ORIGINS` (comma-separated). Unknown origins receive `403` with `CORS_ORIGIN_FORBIDDEN`.
- Local dev/test keep the previous permissive behavior (allowlist optional, same-origin requests without `Origin` header continue to work).
- Example: `CORS_ORIGINS=https://app.example.com,https://admin.example.com`

## Observability

- Prometheus: `GET /metrics` (non-production by default; enable in prod via `METRICS_ENABLED=true`)
- Common series: `http_requests_total`, `http_request_duration_seconds`, Node process metrics.

## Rate limiting + timeouts

- Redis is required for rate-limit persistence in production (`RATE_LIMIT_REDIS_URL`).
- Memory stores are only used in dev/test. Misconfiguration fails fast on boot.
- `express.json` is capped at `REQUEST_BODY_LIMIT` (defaults to `100kb`) to limit abuse; adjust via env if necessary.
- HTTP server request, header, and keep-alive timeouts default to 30s/60s/5s. Override via env vars above if your proxy requires different values.

## Auth lifecycle

- `POST /auth/verify-email` verifies single-use email tokens; returns `204` on success.
- `POST /auth/request-password-reset` always responds `202 {"status":"ok"}` to avoid account enumeration.
- `POST /auth/reset-password` accepts a reset token + new password, consumes the token, and revokes existing sessions.
- `GET /auth/sessions` requires a Bearer access token and returns the caller's sessions with `current`/`valid` metadata.
- `POST /auth/logout-all` revokes all refresh tokens for the authenticated user.
- Login lockouts: repeated failures (IP + email) trigger a temporary `429 LOGIN_LOCKED` until the configured window elapses.

## Edge hardening

- Deploy behind a TLS-terminating reverse proxy or CDN that enforces HSTS and handles TLS certificates.
- Ensure the proxy forwards `x-forwarded-*` headers and configure `trust proxy` if you terminate TLS upstream.
- Apply additional security headers (e.g. HSTS, CSP) at the edge where you control cache and domain policy.

## Version

- `GET /version` → `{ version, gitSha, buildTime }`








