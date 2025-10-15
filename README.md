# Starter: Express + TypeScript + Prisma (Postgres) + JWT

A hiring-manager-friendly Node API starter with:

- **Express 5 (TypeScript)**
- **Prisma** ORM targeting **Postgres**
- **JWT auth**: access + rotating refresh (with reuse detection)
- **Security**: helmet, CORS (open in dev), basic rate limiting
- **Clean error handling** via `AppError`
- **Tests**: Vitest + Supertest (integration)
- **Docker Compose** for the DB (local dev)
- **GitHub Actions CI**: Postgres service, Prisma generate/migrate, run tests, build

No frontend. Minimal surface area. Skimmable and runnable in minutes.

---

## Quick Start (local dev)

Prereqs: Node 20+, Docker, Docker Compose.

```bash
# 1) Clone and install
git clone https://github.com/lucanovello/starter-express-prisma-jwt
cd starter-express-prisma-jwt
npm install

# 2) Configure env
cp .env.example .env
# Edit .env with strong secrets (see ENV section below)

# 3) Start Postgres (Docker)
docker compose up -d db

# 4) Prisma client & migrate schema
npx prisma generate
npx prisma migrate deploy

# 5) Run the API in dev (watch)
npm run dev
# GET http://localhost:3000/health -> {"status":"ok"}
```
