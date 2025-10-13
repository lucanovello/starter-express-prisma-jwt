# starter-express-prisma-jwt

A small, production-style Express + TypeScript starter with Prisma/Postgres, Zod validation, JWT auth (access + rotating refresh), Pino logs, Vitest/Supertest tests, Docker, and GitHub Actions.

## Quick Start

1. Clone the repo and install **_Docker Desktop_**.
2. Copy the default environment:
   **_cp .env.example .env_**.
3. Build and start the services (API + Postgres):
   **_docker compose up --build_**
4. Wait for “_Server running on port 3000_” in the logs.
5. Verify the API health check:
   **_curl http://localhost:3000/health → {"status":"ok"}_**

### Prisma (local dev)

- Start DB: `docker compose up -d db`
- Generate client: `npx prisma generate` (re-run after schema changes)
