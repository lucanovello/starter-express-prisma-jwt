## Summary

Add structured logging with pino/pino-http and per-request correlation via x-request-id. Resolve Express 5 typing friction by casting connect-typed middleware at wiring and typing our custom middlewares with Express handlers.

## Commands

```bash
cp .env.example .env
docker compose up -d db
npm ci
npx prisma migrate deploy
npm run check
```

## Files touched

- src/app.ts
- src/middleware/notFound.ts
- typed RequestHandler - src/middleware/errorHandler.ts
- typed ErrorRequestHandler - src/middleware/security.ts
- cast helmet/cors/rate-limit once at wiring - src/types/pino-http-augment.d.ts
- ambient type so req.id is visible to TS - tests/health.test.ts
- assert x-request-id - package.json / lock / tsconfig.json
- enable interop flags

## Checklist

- [] Changes scoped to this story
- [] App boots; /health returns 200 and includes x-request-id
- [] Tests pass locally
- [] README unchanged (follow-up doc PR optional)
- [] No schema changes

## Acceptance criteria

- Every request logs with a stable correlation id
- Clients receive x-request-id on responses
- No Express 5 typing errors (compiles cleanly)
