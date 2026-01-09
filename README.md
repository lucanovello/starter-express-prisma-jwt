# Express + Prisma + JWT API

[![CI](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml)

Production-style REST API built with Express 5 + TypeScript, Prisma/Postgres, Zod validation, JWT auth (access + rotating refresh), structured logging, and a small operational surface (health/ready/metrics/version).

- Auth: access + refresh JWT, refresh rotation, DB-backed sessions
- Validation: Zod (with OpenAPI generation)
- Security: Helmet, CORS allowlist (required in production), rate limiting (Redis-backed in prod)
- Observability: Pino logs + `/metrics`
- Testing: Vitest + Supertest + isolated `_test` DB
- Docker: local services + production-like compose

## Table of Contents

- [Requirements](#requirements)
- [Quickstart (local dev)](#quickstart-local-dev)
- [Scripts](#scripts)
- [API docs](#api-docs)
- [Operational endpoints](#operational-endpoints)
- [Configuration (env)](#configuration-env)
- [Auth & roles](#auth--roles)
- [Running in Docker (prod-like)](#running-in-docker-prod-like)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Docs](#docs)
- [License](#license)

## Requirements

- **Node.js**: `>=24 <25` (see `package.json`)
- **Docker**: recommended (Postgres for dev/test; Redis for prod-like)

## Quickstart (local dev)

```bash
cp .env.example .env
cp .env.test.example .env.test
npm install

# start Postgres
docker compose up -d db

# Prisma
npx prisma generate
npx prisma migrate deploy

# run API (watch mode)
npm run dev

# verify
curl http://localhost:3000/health
curl http://localhost:3000/ready
curl http://localhost:3000/version
```

> Want the full stack locally (API + Postgres + Redis)?  
> `docker compose --profile dev-app up` (uses `.env` / `COMPOSE_ENV_FILE`).

## Scripts

Common commands:

```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc
npm run start:prod   # build + prisma migrate deploy + node dist/index.js
npm run start:runtime # node dist/index.js (no migrations)
npm test             # vitest run (loads .env.test)
npm run test:cov     # coverage
npm run check        # typecheck + lint + secrets scan + audit + tests
```

## API docs

- **OpenAPI JSON**: `GET /openapi.json`
- **Swagger UI**: `GET /docs` (non-production only)

Regenerate the OpenAPI artifact locally:

```bash
npm run build
npm run openapi:gen
```

## Operational endpoints

- `GET /health` → `200 {"status":"ok"}`
- `GET /ready` → `200 {"status":"ready"}` when dependencies are reachable, else `503`
  - DB unavailable → `NOT_READY`
  - Redis required/configured but unhealthy → `REDIS_NOT_READY`
  - shutdown in progress → `SHUTTING_DOWN`
- `GET /metrics` → Prometheus metrics (guarded/disabled depending on env)
- `GET /version` → `{ version, gitSha, buildTime }`

## Configuration (env)

Example env files:

- `.env.example` → local dev (`.env`)
- `.env.test.example` → tests (`.env.test`)
- `.env.production.example` → production (`.env.production`)

Key variables:

- **Database**: `DATABASE_URL` (required)
- **JWT**: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (required)
- **CORS**: `CORS_ORIGINS` (required in production)
- **Rate limiting**: `RATE_LIMIT_REDIS_URL` (required in production)
- **Metrics**: `METRICS_ENABLED` + guard settings (`METRICS_GUARD`, `METRICS_GUARD_SECRET` / `METRICS_GUARD_ALLOWLIST`)
- **Email (SMTP)**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (+ optional auth/TLS vars)

For the full list and defaults, use the example env files as the source of truth.

## Auth & roles

- JWT access tokens for API authorization
- Rotating refresh tokens backed by DB sessions
- Role model: `USER` and `ADMIN`
- Admin-only sample route: `GET /protected/admin/ping`

Promote/demote a user:

```bash
npm run user:set-role -- --email user@example.com --role ADMIN
npm run user:set-role -- --id <uuid> --role USER
```

Bootstrap the first admin (one-time helper):

```bash
npm run bootstrap:first-admin -- --email admin@example.com
# or: npm run bootstrap:first-admin -- --id <uuid>
```

## Running in Docker (prod-like)

Bare-metal / PaaS style:

```bash
npm run start:prod
```

Single container run (you provide `DATABASE_URL` and secrets):

```bash
docker build -t starter-api .
docker run --rm -p 3000:3000 ^
  -e DATABASE_URL=postgres://... ^
  -e JWT_ACCESS_SECRET=... ^
  -e JWT_REFRESH_SECRET=... ^
  starter-api
```

Docker Compose (prod-like):

```bash
cp .env.production.example .env.production
# edit .env.production with real secrets
docker compose --env-file .env.production -f compose.prod.yml up -d --build
```

## Testing

Tests always load `.env.test` via `TEST_ENV_FILE=.env.test`.

```bash
docker compose up -d db
npm test
```

Notes:

- Test config enforces a localhost `_test` database URL to avoid accidental production usage.
- Redis is not required for tests (rate limiting uses an in-memory store).

## Troubleshooting

- **DB connection fails**: `docker compose ps db` then `docker compose up -d db`
- **Prisma client out of date**: `npx prisma generate`
- **Port in use (3000)** (Windows):
  ```bash
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```
- **Readiness is 503**: check logs and ensure Postgres (and Redis when configured) are healthy.

## Docs

- Development notes: `docs/DEVELOPMENT.md`
- Operational runbook: `docs/ops/runbook.md`
- Security policy: `SECURITY.md`

## License

MIT (see `LICENSE`).
