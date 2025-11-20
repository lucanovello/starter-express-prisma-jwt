# Ops Runbook

## Service overview

- **API**: RESTful Express service on port `3000`; depends on Postgres and Redis.
- **Database**: Postgres 15 with Prisma migrations. Migrate on boot via `npx prisma migrate deploy`.
- **Cache / rate limit**: Redis 7 used for login attempt tracking and shared rate limiting.
- **Health probes**: `/health` (liveness) and `/ready` (readiness, fails when Postgres is unavailable).
- **Bare-metal entrypoint**: `npm run start:prod` builds, runs `prisma migrate deploy` against `DATABASE_URL`, and starts `node dist/index.js`. Use `npm run start:runtime` only when migrations are applied separately (for example managed pipelines).
- **Full-stack dev compose**: `docker compose --profile dev-app up` starts the API alongside the bundled Postgres and Redis services. The container installs dependencies, runs `prisma migrate deploy`, and then `npm run dev`, so keep Prisma migrations committed to keep the compose database in sync.

## Environment & secrets

- Production deployments load runtime configuration from `.env.production` (or the path you set in `COMPOSE_ENV_FILE`). Always run Docker Compose with `--env-file .env.production -f compose.prod.yml ...` so both CLI interpolation and containers receive the same variables.
- Copy `.env.production.example`, set strong `POSTGRES_*`, `REDIS_PASSWORD`, JWT secrets, SMTP creds, and metrics guard variables, then keep the file outside version control. If you rename the file, set `COMPOSE_ENV_FILE=/path/to/file` in your shell or inside the env file itself so `compose.prod.yml` can load it.

### Roles & admin access

- Roles: `USER` (default) and `ADMIN` (required for `/protected/admin/ping` and any admin-only routes you add).
- Promote or demote with the CLI (ensure `DATABASE_URL` targets the right database first):
  - `npm run user:set-role -- --email user@example.com --role ADMIN`
  - `npm run user:set-role -- --id <user-id> --role USER` (prefer `--id` if email is duplicated downstream)
- The user must already exist; the script uses the Prisma client and your current env (.env/.env.production). Keep ADMIN assignments rare, audit them regularly, and rotate tokens/sessions after demotion.

### Postgres credentials

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` configure the bundled `db` service. When `DATABASE_URL` is unset, `compose.prod.yml` builds the DSN from those values and points it at the `db` hostname automatically.
- When targeting a managed database, leave the `db` service stopped, point `DATABASE_URL` at your provider, and keep `POSTGRES_*` in sync for local migrations.
- **Rotating credentials (bundled Postgres):**
  1. Update `.env.production` with the new `POSTGRES_PASSWORD` and matching `DATABASE_URL`.
  2. Apply the change inside the container:
     ```bash
     docker compose --env-file .env.production -f compose.prod.yml exec db psql -U <POSTGRES_USER>
     ALTER USER <POSTGRES_USER> WITH PASSWORD '<POSTGRES_PASSWORD>';
     \q
     ```
     Replace the placeholders with the values you just configured.
  3. Restart the API so Prisma picks up the new DSN.
- **Rotating credentials (managed Postgres):**
  1. Rotate the secret via your provider.
  2. Update `.env.production` (`POSTGRES_*` if you still run the container locally, plus `DATABASE_URL`).
  3. Re-run `docker compose --env-file .env.production -f compose.prod.yml up -d app` to reload the env.

### Redis credentials & persistence

- `REDIS_PASSWORD` is mandatory; the Redis container refuses to start without it and writes append-only data to the `redis_data` volume (file `/data/appendonly.aof`). The API defaults `RATE_LIMIT_REDIS_URL` to `redis://:<REDIS_PASSWORD>@redis:6379/0` so every rate limiter client authenticates.
- Backups: snapshot `/data/appendonly.aof` from the `redis_data` volume for point-in-time recovery or rely on managed Redis persistence if you move off the bundled service.
- **Rotating the password (bundled Redis):**
  1. Update `.env.production` with the new `REDIS_PASSWORD` (and adjust `RATE_LIMIT_REDIS_URL` only if you override the default).
  2. Restart Redis with `docker compose --env-file .env.production -f compose.prod.yml up -d redis`.
  3. Restart the API (`docker compose --env-file .env.production -f compose.prod.yml up -d app`) so the new URL is picked up.
  4. If you have other clients (e.g., scripts) talking to the same Redis instance, update their credentials simultaneously.
- **Rotating the password (managed Redis):**
  1. Rotate the secret in your provider dashboard.
  2. Update `.env.production` (`REDIS_PASSWORD` and `RATE_LIMIT_REDIS_URL`).
  3. Restart the API deployment to pick up the new DSN.
- For manual inspection inside the container, use `docker compose --env-file .env.production -f compose.prod.yml exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" info persistence'`.

### SMTP credentials

- Use provider-issued SMTP users in production; keep credentials in a secrets manager or a restricted `.env.production` outside git, and enable MFA on the email provider.
- Ethereal or other disposable credentials are for development only and should never be reused in staging/production.
- Rotate SMTP credentials periodically or immediately after any suspected leak, update `.env.production`/secret manager entries, and redeploy. If credentials leak, follow the disclosure steps in `SECURITY.md` and record where the exposure occurred.

## Kubernetes deployment notes

- Manifests live in `docs/ops/kubernetes`: `deployment.yaml` (set `serviceAccountName`), `service.yaml`, `configmap.yaml`, `secret.yaml`, `ingress.yaml`, `poddisruptionbudget.yaml`, and `serviceaccount.yaml` (with optional RBAC). Adjust namespaces, ingress class, hostnames, and TLS secret names before applying.
- Keep `DATABASE_URL`, `RATE_LIMIT_REDIS_URL`, and JWT secrets in Kubernetes Secrets (optionally sourced from an external secrets operator) and wire them into the Deployment via `envFrom` as shown in `secret.yaml`. ConfigMap stays for non-sensitive defaults.
- Set `TRUST_PROXY` for your ingress topology so rate limiting and CIDR guards see client IPs: `1` for a single ingress hop, `2` when traffic passes through a load balancer + ingress controller, or CIDR ranges if you pin ingress controller node IPs.
- Protect `/metrics` three ways: (1) prefer `METRICS_GUARD=cidr` with `METRICS_GUARD_ALLOWLIST` covering your Prometheus scrape nodes/namespace, (2) add ingress allowlists/auth annotations (see `ingress.yaml` placeholders) so only monitoring traffic reaches `/metrics`, and/or (3) apply a NetworkPolicy like `networkpolicy-metrics.yaml` that limits port 3000 to ingress controller pods and your monitoring namespace. Keep `METRICS_ENABLED=false` until one of these is in place.
- The PodDisruptionBudget keeps at least one replica running during voluntary disruptions; align `spec.selector.matchLabels` with the Deployment `app` label if you rename it.

## Dashboards & metrics

- **API**: `/metrics` (enable via `METRICS_ENABLED=true`); scrape with Prometheus + Grafana. Starter configs live under `docs/ops/observability` (`prometheus-scrape.yaml` and `grafana-dashboard.json`) and assume either `METRICS_GUARD=cidr` or ingress/NetworkPolicy allowlisting for Prometheus.
- **Database**: pg_stat_activity / connections dashboard (e.g., RDS Performance Insights, Grafana Postgres mixin).
- **Redis**: Monitor `redis_commands_processed`, `evicted_keys`, memory usage.
- **Errors & latency**: Centralised logs (Pino JSON) aggregated via ELK/Stackdriver/CloudWatch depending on hosting.

## Common incidents

### Postgres unavailable

1. Check database container/service:
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml ps db
   docker compose --env-file .env.production -f compose.prod.yml logs db --tail 50
   ```
2. If managed Postgres, verify status and connection limits in provider console.
3. For container deployments, restart the service:
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml up -d db
   ```
4. Confirm readiness of API:
   ```bash
   curl -f http://localhost:3000/ready
   ```
5. After restoration, re-run schema migrations if needed:
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml exec app npx prisma migrate deploy
   ```

### Redis unavailable / rate limiter failing open

1. Inspect Redis logs and health:
   ```bash
   docker compose --env-file .env.production -f compose.prod.yml ps redis
   docker compose --env-file .env.production -f compose.prod.yml logs redis --tail 50
   docker compose --env-file .env.production -f compose.prod.yml exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
   ```
2. No production-safe fallback exists; keep the application in maintenance mode until Redis is restored.
3. After Redis recovers, confirm lockout keys expire (default TTL minutes from env variables) and watch for replayed requests.

### Excessive login lockouts

1. Check auth rate limit configuration: `AUTH_LOGIN_MAX_ATTEMPTS`, `AUTH_LOGIN_LOCKOUT_MINUTES`, `AUTH_LOGIN_ATTEMPT_WINDOW_MINUTES`.
2. To unblock specific users, delete their lockout keys (Prisma `LoginAttempt` table) or flush Redis keys prefixed with `login_attempt`.
3. Review recent auth logs for brute force IPs and update upstream firewall/CDN rules.

### Rate limiting ignores forwarded client IP

1. Confirm `TRUST_PROXY` matches your ingress topology (for example `1` for a single load balancer hop or a CIDR list for static proxy addresses).
2. Ensure the proxy adds or preserves the correct `X-Forwarded-For` header; sanitise untrusted headers if your provider does not do this automatically.
3. Check application logs (`req.ip`) to verify the expected client address is observed after trusting proxies.

### Metrics endpoint failing authentication

1. Ensure `METRICS_ENABLED=true`.
2. Verify guard configuration:
   - `METRICS_GUARD=secret` -> clients must send `x-metrics-secret` header equal to `METRICS_GUARD_SECRET`.
   - `METRICS_GUARD=cidr` -> confirm caller IP within `METRICS_GUARD_ALLOWLIST`.
3. Check app logs for `metrics_guard` warnings.
4. In Kubernetes, confirm Prometheus traffic is allowed by ingress allowlists/auth and any NetworkPolicy rules (see `ingress.yaml` and `networkpolicy-metrics.yaml`).

## Operational tasks

- **Deploy**: Build image, push, then `docker compose --env-file .env.production -f compose.prod.yml up -d`.
- **Schema migrations**: run `npx prisma migrate deploy` (already executed on container start, via `npm run start:prod` for bare metal, and by the `dev-app` compose profile when it boots).
- **Backups**: Configure Postgres WAL backups / snapshots and capture the `postgres_data` + `redis_data` volumes (Redis stores `appendonly.aof` there) or rely on managed backups.
- **Secrets rotation**: Rotate JWT secrets plus the `POSTGRES_*` / `REDIS_PASSWORD` values; update `.env.production`, follow the steps above to apply DB/Redis changes, then restart containers.
- **Scaling**: For Kubernetes, adjust Deployment replicas or apply HPA configuration (see `docs/ops/kubernetes` samples).

## Environment toggles

- `NODE_ENV`: `production` for prod; `development` for local.
- `METRICS_ENABLED`: enable Prometheus metrics.
- `METRICS_GUARD`, `METRICS_GUARD_SECRET`, `METRICS_GUARD_ALLOWLIST`: guard metrics endpoint.
- `CORS_ORIGINS`: comma-separated allowlist; must be set for production.
- `TRUST_PROXY`: Express `trust proxy` directive; default is `loopback`. Set to the number of proxy hops or a CIDR list that matches your ingress so client IPs are preserved for rate limiting and CIDR guards.
- `RATE_LIMIT_REDIS_URL`: configure Redis connection; absence disables Redis-backed rate limiting.
- Auth toggles: `AUTH_EMAIL_VERIFICATION_REQUIRED`, `AUTH_LOGIN_*` to adjust lockout thresholds.
