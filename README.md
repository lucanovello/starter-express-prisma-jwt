# Starter: Express + Prisma + JWT

[![CI](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml)

Minimal, batteries-included REST starter for new Express/Prisma/JWT projects. Use **Use this template** or fork to create your own API quickly. After templating, update the CI badge link above to point at your repository if you want your workflow status visible.

- Auth: access/refresh JWT + rotation
- Prisma/Postgres sessions
- Pino logs with `x-request-id`
- Liveness `/health` and readiness `/ready`
- Response compression + cache headers on metadata endpoints
- CI: Vitest + coverage artifact, container vulnerability scanning

## Table of Contents

- [Using this template](#using-this-template)
- [Quickstart](#quickstart-local-dev)
- [Environment Matrix](#environment-matrix)
- [Testing](#testing)
- [API Documentation](#api-docs--clients)
- [Configuration](#env)
- [Email delivery](#email-delivery)
- [Deployment](#run-in-docker-prod-like)
- [Bootstrapping your first admin user](#bootstrapping-your-first-admin-user)
- [Roles & Admin Access](#roles--admin-access)
- [Renaming your project](#renaming-your-project)
- [Security](#security-policy)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Using this template

- **Create your repo**: Choose **Use this template** (or fork) to make your copy, then clone locally.
- **Copy env files for each stage**:
  - `.env.example` -> `.env` for local development
  - `.env.test.example` -> `.env.test` for the test suite (`npm test`, `npm run check`, CI)
  - `.env.production.example` -> `.env.production` for production and `compose.prod.yml`
    Replace every placeholder with project-specific secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_*` or `DATABASE_URL`, `REDIS_PASSWORD`/`RATE_LIMIT_REDIS_URL`, `CORS_ORIGINS`, metrics guards, and SMTP variables if you want real email delivery.
- **Install dependencies with Node 24.12.0**: Use `nvm use` if available, then `npm install`.
- **Set up the database and Prisma**: Start Postgres via Docker (`docker compose up -d db`), run `npx prisma generate`, then `npx prisma migrate deploy` to create schema tables.
- **Start the API**: `npm run dev` (see [Quickstart](#quickstart-local-dev) for the exact sequence).

For production-like runs, use the compose commands in the [Environment matrix](#environment-matrix) or [Run in Docker (prod-like)](#run-in-docker-prod-like).

## Quickstart (local dev)

```bash
cp .env.example .env
nvm use 24.12.0 # optional but recommended; aligns with .nvmrc and Dockerfile
npm install
docker compose up -d db
npx prisma generate
npx prisma migrate deploy
npm run dev
# GET http://localhost:3000/health -> {"status":"ok"}
# When you need a one-off production-style run (bare metal/systemd/PaaS):
# npm run start:prod  # builds, applies migrations, then runs node dist/index.js
# Or spin up API + Postgres + Redis together in Docker:
# docker compose --profile dev-app up
```

If you want Docker to run everything for you, `docker compose --profile dev-app up` starts the API alongside the bundled Postgres and Redis services. The app container installs dependencies, runs `prisma migrate deploy` against `DATABASE_URL` (defaulting to the compose Postgres service), and then launches `npm run dev` so migrations stay in sync automatically as long as you commit new Prisma migrations.

`cp .env.test.example .env.test` prepares the test suite (`npm run check`, `npm test`), and `.env.production.example` documents the production settings used by `compose.prod.yml`. All example secrets are placeholders; replace every JWT secret, database credential, Redis password/URL, CORS allowlist, and metrics guard secret before you deploy.

> **First time here?** Skim `docs/DEVELOPMENT.md` for deeper setup notes.

## Environment matrix

| Environment               | Entry point                                                                   | Backing services                                             | Notes                                                                                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local development         | `npm run dev` after `docker compose up -d db`                                 | Postgres 15 via `docker-compose.yml`                         | `.env` (copy from `.env.example`) with relaxed defaults; runs in watch mode.                                                                            |
| Local dev (full compose)  | `docker compose --profile dev-app up`                                         | Postgres 15 + Redis 7 via `docker-compose.yml`               | Loads `.env` (or `COMPOSE_ENV_FILE`) into the container, installs deps, applies `prisma migrate deploy`, then runs dev server against compose services. |
| Continuous integration    | `.github/workflows/ci.yml`                                                    | Postgres 15 service container                                | Workflow runs `npm run typecheck && npm run lint && npm run test:ci` plus OpenAPI build; uses `.env.test`.                                              |
| Production docker compose | `docker compose --env-file .env.production -f compose.prod.yml up -d --build` | App, Postgres, Redis with health checks and ordered start-up | Requires strong JWT secrets, explicit `CORS_ORIGINS`, `RATE_LIMIT_REDIS_URL`, and enables readiness probe via `/ready`.                                 |

### Production compose highlights

- `compose.prod.yml` builds the `runner` stage from `Dockerfile`, loads environment variables from `.env.production` (or whatever `COMPOSE_ENV_FILE` you set), and gates API start-up on healthy Postgres/Redis containers. `docker compose --env-file .env.production -f compose.prod.yml up -d --build` works without editing the compose file.
- The API container keeps `npx prisma migrate deploy` as its entrypoint before `node dist/index.js`.
- Postgres credentials now live in `.env.production` as `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`. Those values configure the bundled `db` service **and** are stitched into `DATABASE_URL` automatically when it is left unset, so there are no hard-coded DSNs in the compose file.
- Redis is mandatory in production to back rate limiting. The `redis` service requires `REDIS_PASSWORD`, enables append-only persistence on the `redis_data` volume, and the API defaults `RATE_LIMIT_REDIS_URL` to `redis://:<REDIS_PASSWORD>@redis:6379/0` to ensure authenticated connections. Rotate the password by updating `.env.production`, restarting Redis, and ensuring any managed instance (if you migrate away from the bundled service) is configured with the same secret.
- **Before first deploy**: Copy `.env.production.example` to `.env.production` and replace all placeholder values with strong secrets (`POSTGRES_*`, `REDIS_PASSWORD`, JWTs, metrics guard secrets, SMTP, etc.). Use `openssl rand -base64 32` (or your secret manager) for high-entropy values. Store production SMTP/API credentials in a secrets manager or locked-down `.env.production` outside git, and rotate them immediately if exposed (see [SECURITY.md](./SECURITY.md)).
- Pass your hardened `.env.production` file via `--env-file` (or set `COMPOSE_ENV_FILE` to a different path) or inject secrets through your orchestrator; `.env` and `.env.production` remain git-ignored.
- Keep `METRICS_ENABLED=false` unless you have a guarded Prometheus scraper. When you do enable metrics, use either `METRICS_GUARD=secret` + `METRICS_GUARD_SECRET` or `METRICS_GUARD=cidr` + `METRICS_GUARD_ALLOWLIST`. Runtime config validation enforces the right combination so the compose file no longer blocks deployments when metrics stay disabled.

Operational runbooks live in `docs/ops/runbook.md`. Kubernetes starter manifests are available in `docs/ops/kubernetes` if you prefer deploying outside Docker Compose.
For Kubernetes, inject `DATABASE_URL` and `RATE_LIMIT_REDIS_URL` via Secrets (see `secret.yaml`) and point `TRUST_PROXY` at your ingress hop count or CIDRs so audit logs and rate limits honor real client IPs.

## Testing

**Prepare Postgres first:** start the local database service with `docker compose up -d db`, and copy `.env.test.example` to `.env.test` so the suite can load its own `_test` database URL.

### Local testing

```bash
# Run tests (uses .env.test for configuration)
npm test

# Run tests with coverage
npm run test:cov

# Run full check suite (typecheck + lint + test with coverage)
npm run check
```

**Note:** Tests automatically use `.env.test` configuration. If you need to customize test environment variables, copy `.env.test.example` to `.env.test` and modify as needed (though defaults should work out of the box).

### Test environment

- `.env.test` defaults to `postgresql://postgres:postgres@localhost:5432/starter_test?schema=public`. Tests create the `_test` database and apply Prisma migrations automatically before suites run, but Postgres must be reachable.
- `npm test`, `npm run check`, `npm run test:cov`, and CI's `npm run test:ci` all export `TEST_ENV_FILE=.env.test`, so Vitest always loads the test-only env file rather than `.env`.
- `vitest.setup.ts` imports `tests/setup-env.ts`, which reads the file pointed at by `TEST_ENV_FILE` (defaulting to `.env.test`) via `dotenv` and refuses to start if `DATABASE_URL` is not a localhost URL ending in `_test`.
- If you need extra test-only variables, add them to `.env.test`; the guard script strips `RATE_LIMIT_REDIS_URL` so tests stay fast and hermetic.

### Test database

- The test helpers create and migrate the `_test` database automatically, isolating tests from development data. If initialization fails (for example, Postgres was not running), start the container and rerun the suite.
- To create the test database manually against the bundled Postgres service:
  ```bash
  docker compose up -d db
  docker compose exec db psql -U postgres -c "CREATE DATABASE starter_test;"
  ```
- Rate limiting uses the in-memory store in tests; no Redis setup is required.

## API docs & clients

- OpenAPI is served at `GET /openapi.json` and Swagger UI is available at `/docs` in non-production environments only.
- Regenerate the JSON locally with `npm run build && node scripts/generate-openapi.mjs`; the file is written to `./openapi.json` for sharing or client generation.
- CI publishes the `openapi.json` artifact on every successful run so releases can attach the spec without rebuilding.
- Postman: **File -> Import -> File**, choose `openapi.json`, then pick _Generate collection_.
- Insomnia: **Application -> Preferences -> Data -> Import Data -> From File**, select `openapi.json` and import as a new workspace.

## Health

- `GET /health` -> `200 {"status":"ok"}`
- `GET /ready` -> `200 {"status":"ready"}` when DB (and Redis when configured) respond, else `503 {"error":{"message":"Not Ready","code":"NOT_READY"}}` or `503 {"error":{"message":"Redis not ready","code":"REDIS_NOT_READY"}}`

## Env

Environment defaults live in the example files: `.env.example` (local dev), `.env.test.example` (tests), and `.env.production.example` (production/`compose.prod.yml`). Copy them to `.env`, `.env.test`, and `.env.production` respectively, and replace placeholder secrets before running anything outside local dev: JWT secrets, Postgres credentials (`POSTGRES_*` or `DATABASE_URL`), Redis password/URL, CORS allowlist, and any metrics guard secrets.

| Name                                | Example                                              | Notes                                                                                                  |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| COMPOSE_ENV_FILE                    | .env.production                                      | Path loaded into each service via `env_file`; set to match the `--env-file` you pass to Compose.       |
| DATABASE_URL                        | postgres://user:pass@host:5432/starter?schema=public | Postgres DSN                                                                                           |
| POSTGRES_USER                       | starter                                              | Username for the bundled Postgres service (also used when building the default `DATABASE_URL`).        |
| POSTGRES_PASSWORD                   | prod-db-secret                                       | Password for the bundled Postgres service.                                                             |
| POSTGRES_DB                         | starter                                              | Database created by the bundled Postgres service; set to your managed DB when not running it locally.  |
| JWT_ACCESS_SECRET                   | dev-access                                           | required                                                                                               |
| JWT_REFRESH_SECRET                  | dev-refresh                                          | required                                                                                               |
| JWT_ACCESS_EXPIRY                   | 15m                                                  | default 15m                                                                                            |
| JWT_REFRESH_EXPIRY                  | 7d                                                   | default 7d                                                                                             |
| PORT                                | 3000                                                 | optional                                                                                               |
| CORS_ORIGINS                        | https://app.example.com                              | comma-separated allowlist, required in production                                                      |
| TRUST_PROXY                         | 1                                                    | Express trust proxy setting (`loopback` default; set to hop count or CIDR list for your load balancer) |
| RATE_LIMIT_REDIS_URL                | redis://:very-secret@redis:6379/0                    | Required in production; defaults to `redis://:<REDIS_PASSWORD>@redis:6379/0` when using compose.       |
| REDIS_PASSWORD                      | prod-redis-secret                                    | Password enforced by the bundled Redis service and baked into the default Redis URL.                   |
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
| RESPONSE_COMPRESSION_ENABLED        | true                                                 | toggle gzip compression for JSON/text responses                                                        |
| RESPONSE_COMPRESSION_MIN_BYTES      | 1024                                                 | minimum payload size (bytes) before compression is attempted                                           |
| HTTP_SERVER_REQUEST_TIMEOUT_MS      | 30000                                                | optional override, default 30s                                                                         |
| HTTP_SERVER_HEADERS_TIMEOUT_MS      | 60000                                                | optional override, default 60s                                                                         |
| HTTP_SERVER_KEEPALIVE_TIMEOUT_MS    | 5000                                                 | optional override, default 5s                                                                          |

Note: Example values are placeholders only. URLs use reserved domains and IP ranges (e.g., example.com, 203.0.113.0/24). No real credentials are stored in git.

## Email delivery

- **Default behavior:** When `SMTP_HOST`, `SMTP_PORT`, or `SMTP_FROM` are missing, the service falls back to console logging. In development it logs token hints to help with manual verification; in production the fallback redacts tokens and warns that SMTP is not configured.
- **Automatic SMTP switching:** Providing `SMTP_HOST`, `SMTP_PORT`, and `SMTP_FROM` switches delivery to SMTP. Add `SMTP_USER` and `SMTP_PASS` when your provider requires authentication, and set `SMTP_SECURE=true` when your host expects TLS on connect.
- **Where to configure:** Put SMTP settings in `.env.production` for real delivery, and optionally in `.env` if you want to exercise real emails in development instead of console logs.
- **Example (generic SMTP provider such as SendGrid or Mailgun):**

  ```env
  SMTP_HOST=smtp.yourprovider.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USER=<provider-username-or-apikey>
  SMTP_PASS=<provider-password-or-token>
  SMTP_FROM=noreply@example.com
  ```

  Use the host/user/pass provided by your email vendor; port 587 with `SMTP_SECURE=false` fits most TLS-enabled SMTP gateways.

## Run in Docker (prod-like)

Bare metal or PaaS without the Docker entrypoint? Use `npm run start:prod` to mirror container boot: it builds the app, runs `prisma migrate deploy` against `DATABASE_URL`, then starts `node dist/index.js`. If your platform applies migrations separately, use `npm run start:runtime` to skip the migrate step.

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

- Prometheus: `GET /metrics` (non-production by default; enable in prod via `METRICS_ENABLED=true`). In production, choose either `METRICS_GUARD=secret` with a shared `x-metrics-secret` header or `METRICS_GUARD=cidr` with `METRICS_GUARD_ALLOWLIST`. Unauthorized requests return `401`/`403` without exposing metrics. Example scrape config and a starter Grafana dashboard live in `docs/ops/observability`.
- Common series: `http_requests_total`, `http_request_duration_seconds`, Node process metrics.
- Behind ingress controllers, set `TRUST_PROXY` to the hop count (e.g. `1` for ingress only, `2` for LB + ingress) or to CIDR ranges for your proxy IPs so logs and rate limiting see the right client address. If you expose `/metrics` through ingress, add an allowlist/auth annotation or enforce a NetworkPolicy so only Prometheus reaches it; keep `METRICS_ENABLED=false` until one of those guards exists.
- Version: `GET /version` returns `{ version, gitSha, buildTime }` from the build stamp.

## Responses

- JSON/text responses are compressed (gzip) once they exceed `RESPONSE_COMPRESSION_MIN_BYTES`; disable via `RESPONSE_COMPRESSION_ENABLED=false` when proxies handle compression upstream.
- `/openapi.json` and `/version` emit `Cache-Control: public, max-age=300, stale-while-revalidate=60` so load balancers and CDNs can cache slow-changing metadata without delaying auth-enabled endpoints.

## Logging

- Structured Pino logs include a per-request `x-request-id`.
- Sensitive headers and payload fields (`authorization`, `cookie`, `x-metrics-secret`, password/token fields, etc.) are redacted to `[REDACTED]`. Extend via `LOG_REDACTION_PATHS` if you add new secrets.

## Rate limiting + timeouts

- Redis is required for rate-limit persistence in production (`RATE_LIMIT_REDIS_URL`).
- `/ready` fails fast with `REDIS_NOT_READY` when Redis is configured but unreachable, preventing traffic from bypassing rate limits and lockouts.
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
node --version  # Should be 24.12.0 or compatible
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
docker compose --env-file .env.production -f compose.prod.yml ps redis
docker compose --env-file .env.production -f compose.prod.yml logs redis
```

#### Email Service Issues

**Problem:** Emails not being sent in development

**Solutions:**

```bash
# 1. Check if email service is configured
# In development, emails log to console by default (no SMTP needed).
# In production, the console fallback redacts tokens and logs a warning; configure SMTP for delivery.
# Use a secrets manager or restricted `.env.production` for SMTP credentials, enable MFA on the provider,
# and rotate credentials if they are ever shared or checked in. Report leaks per SECURITY.md.

# 2. For SMTP testing in dev only, configure these variables in .env:
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<YOUR_ETHEREAL_USERNAME>
SMTP_PASS=<YOUR_ETHEREAL_PASSWORD>

# 3. Get free test credentials at https://ethereal.email
# Do not reuse Ethereal or other test credentials in production. Use provider-issued SMTP users in prod.
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

This starter is provided as-is as a template; external support and upstream PR triage are limited. If you fork it, lean on the included docs:

- [SECURITY.md](./SECURITY.md) - Security policy and best practices
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Detailed developer guide
- [docs/RENOVATE.md](./docs/RENOVATE.md) - Dependency automation
- [docs/ops/runbook.md](./docs/ops/runbook.md) - Operational guidance

## Bootstrapping your first admin user

This starter ships with an `ADMIN` role and sample admin-only route `GET /protected/admin/ping`. Use the steps below once per environment to seed the first admin, then fold admin creation into your own product flows (and delete the helper script if you don't need it).

1. **Create a user** via the existing registration endpoint (or with Prisma). Example against local dev:

   ```bash
   curl -X POST http://localhost:3000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"ChangeMe123!"}'
   ```

   The response includes access/refresh tokens unless email verification is enforced; you can always log in later with `POST /auth/login` to fetch a fresh token.

2. **Promote that user to ADMIN** using the Prisma-powered CLI (ensure `DATABASE_URL` points at the right database first):

   ```bash
   npm run user:set-role -- --email admin@example.com --role ADMIN
   # convenience wrapper for the same promotion
   npm run bootstrap:first-admin -- --email admin@example.com
   ```

   Prefer `--id <user-id>` when the email is duplicated downstream. If you prefer SQL to the helper scripts, Prisma exposes `npx prisma db execute --stdin`:

   ```bash
   npx prisma db execute --stdin <<'SQL'
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
   SQL
   ```

3. **Verify access** by hitting the admin-only route with a bearer token:

   ```bash
   curl -H "Authorization: Bearer <access-token>" http://localhost:3000/protected/admin/ping
   ```

   The token can come from the register response or a later login; keep ADMIN assignments scarce and audited.

## Roles & Admin Access

- Roles available: `USER` (default) and `ADMIN` (required for `/protected/admin/ping` and any future admin-only endpoints).
- Promote a user by email: `npm run user:set-role -- --email user@example.com --role ADMIN` (use `--id <user-id>` if email is not unique in your data source).
- Demote or fix incorrect access the same way: `npm run user:set-role -- --email user@example.com --role USER`.
- The CLI uses your current environment configuration and Prisma client; point `DATABASE_URL` (or your `.env.production` via `COMPOSE_ENV_FILE`) at the target database **before** running it.
- Keep ADMIN accounts scarce and audited; rotate tokens/sessions for demoted users if they held elevated access.

## Renaming your project

- Update `package.json` `"name"` (and repository/homepage links) plus the CI badge URL near the top of this README so it points at your repository.
- Adjust database names if desired: change `POSTGRES_DB` and any `DATABASE_URL` values in `.env`, `.env.test`, `.env.production`, and `compose.prod.yml` when you want something other than the default `starter`/`starter_test`.
- If you publish container images, change the example tag `starter-api` and the `image: app:prod` entry in `compose.prod.yml` to your preferred registry/repository names.
- Run a quick search for `starter-express-prisma-jwt` or `starter` to catch any remaining references (for example in docs, badges, and build logs).

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

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details. Projects created from this template can keep MIT or swap in an alternative license that fits their needs; update your fork accordingly.
