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

| Name               | Example      | Notes        |
| ------------------ | ------------ | ------------ |
| DATABASE_URL       | postgres://… | Postgres DSN |
| JWT_ACCESS_SECRET  | dev-access   | required     |
| JWT_REFRESH_SECRET | dev-refresh  | required     |
| JWT_ACCESS_EXPIRY  | 15m          | default 15m  |
| JWT_REFRESH_EXPIRY | 7d           | default 7d   |
| PORT               | 3000         | optional     |

## Run in Docker (prod-like)

```bash
docker build -t starter-api .
docker run --rm -p 3000:3000   -e DATABASE_URL=postgres://...   -e JWT_ACCESS_SECRET=...   -e JWT_REFRESH_SECRET=...   starter-api
```

## API docs

- Swagger UI: `GET /docs` (non-production)
- Raw spec: `GET /openapi.json` (all environments)

### CORS

- Default (no `CORS_ORIGINS`): all origins allowed (good for local/dev).
- Production: set `CORS_ORIGINS` to a comma-separated allowlist, e.g.  
  `CORS_ORIGINS=https://app.example.com,https://admin.example.com`

## Observability

- Prometheus: `GET /metrics` (non-production by default; enable in prod via `METRICS_ENABLED=true`)
- Common series: `http_requests_total`, `http_request_duration_seconds`, Node process metrics.

## Version

- `GET /version` → `{ version, gitSha, buildTime }`
