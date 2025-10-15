# starter-express-prisma-jwt

[![CI](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/lucanovello/starter-express-prisma-jwt/actions/workflows/ci.yml)

A small, production-style **Express + TypeScript** starter with **Prisma/Postgres**, **JWT auth** (access + rotating refresh coming in M2 Step 6), clean **error handling**, **Docker**, and **GitHub Actions**. Built to be skimmed and run in minutes.

---

## Stack & Features (current)

- **Express 5 + TypeScript** with minimal, readable structure
- **Prisma** (PostgreSQL) with `User` and `Session` models
- **JWT helpers** (`signAccess/verifyAccess`, `signRefresh/verifyRefresh`)
- **Security middleware**: `helmet`, `cors` (open in dev), `express-rate-limit`
- **Error handling**: JSON 404 + centralized error handler with `AppError`
- **Docker Compose** for Postgres
- **CI**: Build (TypeScript) on push/PR (tests later)
- **LF endings** enforced via `.gitattributes`

> Coming next (M2): password hashing utilities (argon2), then auth routes with rotating refresh tokens and reuse detection.

---

## Quick Start

1. **Clone** and ensure **Docker Desktop** is running.
2. **Environment file**:
   ```bash
   cp .env.example .env
   ```
3. **Start Postgres (dev)**:
   docker compose up -d db
4. **Generate Prisma client & run migrations (if you’ve changed the schema)**:
   npx prisma generate
   npx prisma migrate dev
5. **Run the API (dev)**:
   npm run dev
6. **Health check**:
   curl http://localhost:3000/health
   # -> {"status":"ok"}
