# Development Setup Guide

Complete guide for setting up your local development environment.

## Prerequisites

- **Node.js**: 20.19.0 (specified in `.nvmrc`)
- **Docker**: For running Postgres and Redis locally
- **Git**: For version control

### Recommended Tools

- **nvm** (Node Version Manager): For managing Node versions
- **Docker Desktop**: Easier than managing Docker CLI directly
- **VS Code**: Recommended IDE with extensions:
  - Prisma
  - ESLint
  - Prettier
  - Docker

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/lucanovello/starter-express-prisma-jwt.git
cd starter-express-prisma-jwt

# Use the correct Node version (if using nvm)
nvm use

# Install dependencies (this also sets up git hooks automatically)
npm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
# Most defaults work for local development, but you should change:
# - JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (use strong random strings)
```

**Minimum required changes for local dev:**

```env
JWT_ACCESS_SECRET=your-strong-random-secret-here-min-32-chars
JWT_REFRESH_SECRET=another-strong-random-secret-here-min-32-chars
```

### 3. Start Database

```bash
# Start Postgres in Docker
docker compose up -d db

# Verify it's running
docker compose ps

# Expected output:
# NAME                     IMAGE         STATUS
# starter-express-...-db-1 postgres:15   Up About a minute
```

> Optional: if you want to exercise the Redis-backed rate limiter locally, start the Redis helper container with `docker compose --profile rate-limit up -d redis` and then set `RATE_LIMIT_REDIS_URL=redis://localhost:6379` in your `.env`.

### 4. Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations to create tables
npx prisma migrate deploy

# (Optional) View database with Prisma Studio
npx prisma studio
# Opens at http://localhost:5555
```

### 5. Start Development Server

```bash
# Start the API in watch mode
npm run dev

# You should see:
# API listening on http://localhost:3000
```

### 6. Verify Setup

```bash
# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# Test readiness endpoint
curl http://localhost:3000/ready
# Expected: {"status":"ready"}

# View API version
curl http://localhost:3000/version
# Expected: {"version":"1.0.0","gitSha":"...","buildTime":"..."}
```

## Testing Setup

Tests use a separate database to avoid conflicts with development data.

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run full check (typecheck + lint + test)
npm run check
```

### Test Configuration

Tests automatically use `.env.test` which points to a separate `starter_test` database. The default configuration works out of the box, but you can customize by copying:

```bash
cp .env.test.example .env.test
# Then edit .env.test as needed
```

## Git Hooks

Git hooks are automatically installed via the `prepare` script during `npm install`. They enforce code quality:

### Pre-commit Hook

- Runs ESLint auto-fix on staged files
- Formats code with Prettier
- Only processes staged files (fast!)

### Pre-push Hook

- Runs TypeScript type checking
- Runs full test suite
- Prevents pushing broken code

### Bypass Hooks (Use Sparingly)

```bash
# Skip pre-commit hook
git commit --no-verify

# Skip pre-push hook
git push --no-verify
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

```bash
# Edit code...
# Git hooks will auto-format on commit

git add .
git commit -m "feat: add new feature"
```

### 3. Run Checks Before Pushing

```bash
# Run full check suite
npm run check

# If all pass, push
git push
```

### 4. Create Pull Request

- Push your branch to GitHub
- Create a PR against `main`
- CI will run all checks automatically
- Address any failures before merging

## Database Management

### View Data with Prisma Studio

```bash
npx prisma studio
```

Opens a GUI at http://localhost:5555 to view and edit data.

### Reset Database

```bash
# Drop and recreate all tables (DESTRUCTIVE!)
npx prisma migrate reset

# Or manually via Docker
docker compose down -v  # Removes volumes
docker compose up -d db
npx prisma migrate deploy
```

### Create a New Migration

```bash
# 1. Edit prisma/schema.prisma
# 2. Create and apply migration
npx prisma migrate dev --name descriptive_migration_name

# Example:
npx prisma migrate dev --name add_user_avatar_field
```

### View Migration Status

```bash
npx prisma migrate status
```

## Common Development Tasks

### Add a New Environment Variable

1. Add to `src/config/index.ts` in `EnvSchema`
2. Add to `.env.example` with description
3. Add to `.env.test.example` if needed
4. Update README.md environment table
5. Add validation tests in `tests/config.env.test.ts`

### Add a New API Endpoint

1. Define route in `src/routes/`
2. Add Zod schema in `src/dto/`
3. Implement logic in `src/services/`
4. Add tests in `tests/`
5. Update OpenAPI spec (auto-generated, but review)

### Add a New Database Table

1. Edit `prisma/schema.prisma`
2. Create migration: `npx prisma migrate dev --name add_table_name`
3. Generate client: `npx prisma generate` (automatic on save)
4. Update TypeScript types if needed

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["test"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### View Logs

```bash
# Development server logs (with pino-pretty)
npm run dev

# View Docker logs
docker compose logs -f db

# View specific test logs
npm test -- --reporter=verbose
```

## Cleaning Up

### Stop Services

```bash
# Stop database
docker compose down

# Remove volumes (deletes data)
docker compose down -v
```

### Clean Build Artifacts

```bash
# Remove build output
rm -rf dist/

# Remove coverage
rm -rf coverage/

# Remove node_modules (rarely needed)
rm -rf node_modules/
npm install
```

## Next Steps

- Read the main [README.md](../README.md) for API documentation
- Check [docs/ops/runbook.md](./ops/runbook.md) for operational guidance
- Review existing tests in `tests/` for examples
- Join discussions on GitHub

## Getting Help

- **Issues:** https://github.com/lucanovello/starter-express-prisma-jwt/issues
- **Discussions:** https://github.com/lucanovello/starter-express-prisma-jwt/discussions
