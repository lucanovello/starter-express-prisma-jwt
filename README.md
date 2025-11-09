# Starter: Express + Prisma + JWT

[![CI](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml)

Minimal, batteries-included REST starter:

- Auth: access/refresh JWT + rotation
- Prisma/Postgres sessions
- Pino logs with `x-request-id`
- Liveness `/health` and readiness `/ready`
- CI: Vitest + coverage artifact, container vulnerability scanning

## Table of Contents

- [Quickstart](#quickstart-local-dev)
- [Environment Matrix](#environment-matrix)
- [Testing](#test)
- [API Documentation](#api-docs--clients)
- [Configuration](#env)
- [Deployment](#run-in-docker-prod-like)
- [Contributing](#contributing)
- [Security](#security-policy)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)

## Quickstart (local dev)

```bash
cp .env.example .env
docker compose up -d db redis
npm i
npx prisma generate
npx prisma migrate deploy
npm run dev
# (Ensure you're using Node 20.x)
# GET http://localhost:3000/health -> {"status":"ok"}
# When you need a one-off production-style run:
# npm start  # (prebuilds automatically and runs node dist/index.js)
```

> **First time here?** Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed setup instructions.
> **Security note:** Secrets should never live in version control. If `.env*` files were previously committed, rotate every credential (JWT secrets, database passwords, metrics guard values) before deploying.
> **Full-stack in Docker:** Prefer `docker compose up -d app` to run API + Postgres + Redis fully containerized. When the API runs inside the compose network use `db` and `redis` service names in your env (`DATABASE_URL=postgres://postgres:postgres@db:5432/starter?schema=public`, `RATE_LIMIT_REDIS_URL=redis://redis:6379`). When running the API on your host, use `localhost` (`postgres://...@localhost:5432/...`, `redis://localhost:6379`).

## Environment matrix

| Environment                | Entry point                                                                   | Backing services                                             | Notes                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local development (host)   | `npm run dev` after `docker compose up -d db redis`                           | Postgres 15 + optional Redis via `docker-compose.yml`        | `.env` (copy from `.env.example`) with relaxed defaults; Redis optional (in-memory rate limit if unset).                                                        |
| Local development (docker) | `docker compose up -d app`                                                    | App, Postgres 15, Redis                                      | Containerized dev: use service-name hosts (`db`, `redis`); hot reload not enabled (uses build dist).                                                            |
| Continuous integration     | `.github/workflows/ci.yml`                                                    | Postgres 15 service container                                | Workflow runs `npm run typecheck && npm run lint && npm run test:ci` plus OpenAPI build; includes container vulnerability scanning via Trivy; uses `.env.test`. |
| Production docker compose  | `docker compose --env-file .env.production -f compose.prod.yml up -d --build` | App, Postgres, Redis with health checks and ordered start-up | Requires strong JWT secrets, explicit `CORS_ORIGINS`, `RATE_LIMIT_REDIS_URL`, and enables readiness probe via `/ready`.                                         |

### Production compose highlights

- `compose.prod.yml` builds the `runner` stage from `Dockerfile`, then starts Postgres and Redis with health checks before the API.
- The API container keeps `npx prisma migrate deploy` as its entrypoint before `node dist/index.js`.
- Redis is mandatory in production to back rate limiting (`RATE_LIMIT_REDIS_URL`); the container exits unhealthy if Redis fails.
- Development: you can run the stack entirely via `docker compose up -d app` (API + Postgres + Redis) or run the API on host pointing at compose services (`docker compose up -d db redis`).
- Inside containers use service DNS names (`db`, `redis`); on host use `localhost`.
- **Before first deploy**: Copy `.env.production.example` to `.env.production` and replace all placeholder values with strong secrets. Use `openssl rand -base64 32` to generate JWT secrets and metrics secrets.
- Pass your hardened `.env.production` file via `--env-file` or inject secrets through your orchestrator; `.env` and `.env.production` remain git-ignored.
- `METRICS_GUARD` and `METRICS_GUARD_SECRET` are now **required** in production when `METRICS_ENABLED=true`; weak defaults have been removed to prevent security misconfigurations.
- Keep `METRICS_ENABLED=false` unless you have a guarded Prometheus scraper; when enabling, also set `METRICS_GUARD` + secret/allowlist.

Operational runbooks live in `docs/ops/runbook.md`. Kubernetes starter manifests are available in `docs/ops/kubernetes` if you prefer deploying outside Docker Compose.

## Test

### Local Testing

```bash
# Run tests (uses .env.test for configuration)
npm test

# Run tests with coverage
npm run test:cov

# Run full check suite (typecheck + lint + test with coverage)
npm run check
```

**Note:** Tests automatically use `.env.test` configuration. If you need to customize test environment variables, copy `.env.test.example` to `.env.test` and modify as needed (though defaults should work out of the box).

### Test Database

Tests use a separate database (`starter_test`) to avoid conflicts with development data. The test setup automatically:

- Connects to `postgresql://postgres:postgres@localhost:5432/starter_test`
- Resets the database between test suites
- Uses in-memory rate limiting (no Redis required)

## API docs & clients

- OpenAPI is served at `GET /openapi.json` and Swagger UI is available at `/docs` in non-production environments only.
- Regenerate the JSON locally with `npm run build && node scripts/generate-openapi.mjs`; the file is written to `./openapi.json` for sharing or client generation.
- CI publishes the `openapi.json` artifact on every successful run so releases can attach the spec without rebuilding.
- Postman: **File -> Import -> File**, choose `openapi.json`, then pick _Generate collection_.
- Insomnia: **Application -> Preferences -> Data -> Import Data -> From File**, select `openapi.json` and import as a new workspace.

## Health

- `GET /health` â†’ `200 {"status":"ok"}`
- `GET /ready` â†’ `200 {"status":"ready"}` when DB responds, else `503 {"error":{"message":"Not Ready","code":"NOT_READY"}}`

## Env

| Name                                | Example                                              | Notes                                                                                                  |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DATABASE_URL                        | postgres://user:pass@host:5432/starter?schema=public | Postgres DSN                                                                                           |
| JWT_ACCESS_SECRET                   | dev-access                                           | required                                                                                               |
| JWT_REFRESH_SECRET                  | dev-refresh                                          | required                                                                                               |
| JWT_ACCESS_EXPIRY                   | 15m                                                  | default 15m                                                                                            |
| JWT_REFRESH_EXPIRY                  | 7d                                                   | default 7d                                                                                             |
| PORT                                | 3000                                                 | optional                                                                                               |
| CORS_ORIGINS                        | https://app.example.com                              | comma-separated allowlist, required in production                                                      |
| CORS_ALLOW_CREDENTIALS              | false                                                | default off in production; enable **only** when you need credentialed cross-origin requests            |
| CORS_MAX_AGE_SECONDS                | 600                                                  | cache duration for CORS preflight responses                                                            |
| TRUST_PROXY                         | 1                                                    | Express trust proxy setting (`loopback` default; set to hop count or CIDR list for your load balancer) |
| RATE_LIMIT_REDIS_URL                | redis://cache:6379                                   | required in production                                                                                 |
|                                     | redis://localhost:6379                               | host dev URL (API on host, Redis in compose)                                                           |
|                                     | redis://redis:6379                                   | docker dev URL (API in compose with Redis)                                                             |
| METRICS_ENABLED                     | false                                                | Enable Prometheus `/metrics`; defaults off in production                                               |
| METRICS_GUARD                       | secret                                               | Use `secret` (shared header) or `cidr` (IP allowlist) in prod                                          |
| METRICS_GUARD_SECRET                | prod-metrics-secret                                  | Required when `METRICS_GUARD=secret`; clients send `x-metrics-secret`                                  |
| METRICS_GUARD_ALLOWLIST             | 203.0.113.0/24                                       | Comma-separated CIDRs when `METRICS_GUARD=cidr`                                                        |
| AUTH_EMAIL_VERIFICATION_REQUIRED    | false                                                | defaults to false; when true, new sign-ins require verified email                                      |
| AUTH_EMAIL_VERIFICATION_TTL_MINUTES | 60                                                   | TTL for verification tokens (minutes)                                                                  |
| AUTH_PASSWORD_RESET_TTL_MINUTES     | 30                                                   | TTL for password reset tokens (minutes)                                                                |
| AUTH_LOGIN_MAX_ATTEMPTS             | 5                                                    | Maximum failed logins per IP/email before lockout                                                      |
| AUTH_LOGIN_LOCKOUT_MINUTES          | 15                                                   | Lockout duration (minutes)                                                                             |
| AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES   | 15                                                   | Rolling window for counting login attempts (minutes)                                                   |
| REQUEST_BODY_LIMIT                  | 100kb                                                | optional override for express.json()                                                                   |
| HTTP_SERVER_REQUEST_TIMEOUT_MS      | 30000                                                | optional override, default 30s                                                                         |
| HTTP_SERVER_HEADERS_TIMEOUT_MS      | 60000                                                | optional override, default 60s                                                                         |
| HTTP_SERVER_KEEPALIVE_TIMEOUT_MS    | 5000                                                 | optional override, default 5s                                                                          |

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
- Local dev/test keep the previous permissive behavior (allowlist optional, same-origin requests without `Origin` header continue to work). Credentialed requests remain enabled in dev by default.
- In production, credentialed CORS requests are disabled unless you explicitly set `CORS_ALLOW_CREDENTIALS=true`. Most JWT-based SPA flows do not need this.
- Responses expose `x-request-id`, `RateLimit-*`, and `Retry-After` headers so clients can reference logs and react to throttling.
- Preflight responses advertise `Access-Control-Max-Age` (default 600s); adjust via `CORS_MAX_AGE_SECONDS` if your proxy needs different caching.
- Example: `CORS_ORIGINS=https://app.example.com,https://admin.example.com`

## Observability

- Prometheus: `GET /metrics` (non-production by default; enable in prod via `METRICS_ENABLED=true`). In production, choose either `METRICS_GUARD=secret` with a shared `x-metrics-secret` header or `METRICS_GUARD=cidr` with `METRICS_GUARD_ALLOWLIST`. Unauthorized requests return `401`/`403` without exposing metrics.
- Common series: `http_requests_total`, `http_request_duration_seconds`, Node process metrics.
- Version: `GET /version` returns `{ version, gitSha, buildTime }` from the build stamp.

## Logging

- Structured Pino logs include a per-request `x-request-id`.
- Sensitive headers and payload fields (`authorization`, `cookie`, `x-metrics-secret`, password/token fields, etc.) are redacted to `[REDACTED]`. Extend via `LOG_REDACTION_PATHS` if you add new secrets.

## Rate limiting + timeouts

- Redis is required for rate-limit persistence in production (`RATE_LIMIT_REDIS_URL`).
- Local development defaults to in-memory throttling. Uncomment `RATE_LIMIT_REDIS_URL` after starting the optional Redis container (e.g. `docker compose --profile rate-limit up -d redis`) if you want to exercise the Redis-backed path.
- Express trusts proxy headers via `TRUST_PROXY`. The default `loopback` works for local dev; set it to the number of proxy hops (e.g. `1`) or a CIDR list that matches your ingress so rate limiting and CIDR guards see the real client IP.
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

## Dependency management

This project uses [Renovate](https://docs.renovatebot.com/) for automated dependency updates:

- **Auto-merge**: Patch and minor updates merge automatically after 3-day stability period
- **Manual review**: Major updates require approval (may contain breaking changes)
- **Security first**: Critical vulnerabilities are updated immediately
- **Weekly schedule**: Updates run Monday mornings to give you time to review

See `docs/RENOVATE.md` for full configuration details and customization options.

## Edge hardening

- Deploy behind a TLS-terminating reverse proxy or CDN that enforces HSTS and handles TLS certificates.
- Ensure the proxy forwards `x-forwarded-*` headers and configure `trust proxy` if you terminate TLS upstream.
- Apply additional security headers (e.g. HSTS, CSP) at the edge where you control cache and domain policy.

## Version

- `GET /version` -> `{ version, gitSha, buildTime }`
- Versioning policy: routes are treated as **v1** today. Mount behind `/v1` at the gateway and reserve new `/v{n}` prefixes for breaking changes.

## Troubleshooting

### Common Issues

#### Database Connection Errors

**Problem:** `Error: Can't reach database server`

**Solutions:**

```bash
# 1. Ensure Postgres is running
docker compose ps db

# 2. Start the database if needed
docker compose up -d db

# 3. Verify connection string in .env matches docker-compose.yml
# Default: postgresql://postgres:postgres@localhost:5432/starter?schema=public

# 4. Check if port 5432 is already in use
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows
```

#### Test Failures

**Problem:** Tests fail with database errors

**Solutions:**

```bash
# 1. Ensure test database exists and migrations are applied
docker compose up -d db
npx prisma migrate deploy

# 2. Reset test database if corrupted
dropdb starter_test && createdb starter_test  # If psql is installed
# OR restart the Docker container
docker compose restart db

# 3. Verify .env.test configuration
cat .env.test  # Should point to starter_test database
```

#### Git Hooks Not Running

**Problem:** Commits succeed without running linters/formatters

**Solutions:**

```bash
# 1. Reinstall hooks
npm run prepare

# 2. Verify hooks are executable (macOS/Linux)
chmod +x .husky/pre-commit .husky/pre-push

# 3. Check if husky is installed
ls -la .husky/
```

#### Type Errors After Dependencies Update

**Problem:** TypeScript compilation fails after `npm install`

**Solutions:**

```bash
# 1. Regenerate Prisma client
npx prisma generate

# 2. Clear TypeScript build cache
rm -rf node_modules/.cache
npm run typecheck

# 3. Verify Node version
node --version  # Should be 20.19.0 or compatible with 20.x
```

#### Port Already in Use

**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions:**

```bash
# 1. Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :3000  # Windows (note the PID, then: taskkill /PID <PID> /F)

# 2. Use a different port
PORT=3001 npm run dev
```

#### Redis Connection Issues (Production)

**Problem:** Rate limiting fails in production

**Solutions:**

```bash
# 1. Verify RATE_LIMIT_REDIS_URL is set correctly
echo $RATE_LIMIT_REDIS_URL

# 2. Test Redis connection
redis-cli -u $RATE_LIMIT_REDIS_URL ping

# 3. Check Redis is running in compose setup
docker compose -f compose.prod.yml ps redis
docker compose -f compose.prod.yml logs redis
```

#### Email Service Issues

**Problem:** Emails not being sent in development

**Solutions:**

```bash
# 1. Check if email service is configured
# In development, emails log to console by default (no SMTP needed)
# In production, the console fallback redacts tokens and logs a warning; configure SMTP for delivery.

# 2. For SMTP testing, configure these variables in .env:
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<YOUR_ETHEREAL_USERNAME>
SMTP_PASS=<YOUR_ETHEREAL_PASSWORD>

# 3. Get free test credentials at https://ethereal.email
```

#### Authentication Token Errors

**Problem:** JWT verification fails

**Solutions:**

```bash
# 1. Ensure secrets are set correctly in .env
JWT_ACCESS_SECRET=<YOUR_SECRET_HERE>
JWT_REFRESH_SECRET=<YOUR_DIFFERENT_SECRET_HERE>

# 2. Generate new secrets if needed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Clear existing sessions
# Delete all sessions from database or restart with fresh DB

# 4. Check token expiry settings
JWT_ACCESS_EXPIRY=15m  # Short-lived
JWT_REFRESH_EXPIRY=7d  # Longer-lived
```

#### Coverage Threshold Errors

**Problem:** Tests pass but coverage check fails

**Solutions:**

```bash
# 1. Check current coverage
npm run test:cov

# 2. Identify uncovered lines in report
open coverage/lcov-report/index.html

# 3. Add tests for uncovered branches/functions
# Thresholds: 85% lines, 85% functions, 80% branches, 70% statements

# 4. Temporarily view detailed coverage
npm run test:cov -- --reporter=verbose
```

#### Prisma Migration Issues

**Problem:** Migrations fail or schema out of sync

**Solutions:**

```bash
# 1. Reset development database (WARNING: Deletes all data)
npx prisma migrate reset

# 2. Generate Prisma client after schema changes
npx prisma generate

# 3. Create a new migration
npx prisma migrate dev --name your_migration_name

# 4. Apply migrations in production
npx prisma migrate deploy

# 5. View migration status
npx prisma migrate status
```

#### Docker Build Failures

**Problem:** Docker build fails or image won't start

**Solutions:**

```bash
# 1. Clear Docker cache
docker builder prune

# 2. Rebuild without cache
docker build --no-cache -t starter-api .

# 3. Check logs
docker logs <container-id>

# 4. Verify environment variables are passed
docker run --rm -e DATABASE_URL=$DATABASE_URL starter-api

# 5. Test locally first
npm run build
node dist/index.js
```

### Getting Help

Still stuck? Here's where to get help:

- **Documentation:**
  - [CONTRIBUTING.md](./CONTRIBUTING.md) - Development setup and guidelines
  - [SECURITY.md](./SECURITY.md) - Security policy and best practices
  - [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Detailed developer guide
  - [docs/RENOVATE.md](./docs/RENOVATE.md) - Dependency automation
  - [docs/ops/runbook.md](./docs/ops/runbook.md) - Operational guidance

- **Support:**
  - [Issues](https://github.com/lucanovello/starter-express-prisma-jwt/issues) - Bug reports and feature requests
  - [Discussions](https://github.com/lucanovello/starter-express-prisma-jwt/discussions) - Questions and community help

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup and workflow
- Coding standards and best practices
- Testing guidelines
- Pull request process
- Commit message conventions

## Security Policy

Security is a top priority. Please review [SECURITY.md](./SECURITY.md) for:

- Reporting vulnerabilities (do not open public issues)
- Supported versions
- Security best practices
- Known security features

**Found a security issue?** Report it privately via [GitHub Security Advisories](https://github.com/lucanovello/starter-express-prisma-jwt/security/advisories/new).

## Changelog

All notable changes are documented in [CHANGELOG.md](./CHANGELOG.md), following [Keep a Changelog](https://keepachangelog.com/) format.

**Current version:** 1.0.0

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

```

```
