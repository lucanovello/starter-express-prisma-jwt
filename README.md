# starter-express-prisma-jwt

A small, production-style Express + TypeScript starter with Prisma/Postgres, Zod validation, JWT auth (access + rotating refresh), Pino logs, Vitest/Supertest tests, Docker, and GitHub Actions.

## Quick Start

1. Clone the repo and install Docker Desktop.
2. Copy the default environment:
   cp .env.example .env
3. Build and start the services (API + Postgres):
   docker compose up --build
4. Wait for “Server running on port 3000” in the logs.
5. Verify the API health check:
   curl http://localhost:3000/health
   # → {"status":"ok"}
