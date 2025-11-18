# Ops Runbook

## Service overview

- **API**: RESTful Express service on port `3000`; depends on Postgres and Redis.
- **Database**: Postgres 15 with Prisma migrations. Migrate on boot via `npx prisma migrate deploy`.
- **Cache / rate limit**: Redis 7 used for login attempt tracking and shared rate limiting.
- **Health probes**: `/health` (liveness) and `/ready` (readiness, fails when Postgres is unavailable).

## Dashboards & metrics

- **API**: `/metrics` (enable via `METRICS_ENABLED=true`); scrape with Prometheus + Grafana.
- **Database**: pg_stat_activity / connections dashboard (e.g., RDS Performance Insights, Grafana Postgres mixin).
- **Redis**: Monitor `redis_commands_processed`, `evicted_keys`, memory usage.
- **Errors & latency**: Centralised logs (Pino JSON) aggregated via ELK/Stackdriver/CloudWatch depending on hosting.

## Common incidents

### Postgres unavailable

1. Check database container/service:
   ```bash
   docker compose -f compose.prod.yml ps db
   docker compose -f compose.prod.yml logs db --tail 50
   ```
2. If managed Postgres, verify status and connection limits in provider console.
3. For container deployments, restart the service:
   ```bash
   docker compose -f compose.prod.yml up -d db
   ```
4. Confirm readiness of API:
   ```bash
   curl -f http://localhost:3000/ready
   ```
5. After restoration, re-run schema migrations if needed:
   ```bash
   docker compose -f compose.prod.yml exec app npx prisma migrate deploy
   ```

### Redis unavailable / rate limiter failing open

1. Inspect Redis logs and health:
   ```bash
   docker compose -f compose.prod.yml ps redis
   docker compose -f compose.prod.yml logs redis --tail 50
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

## Operational tasks

- **Deploy**: Build image, push, then `docker compose -f compose.prod.yml up -d`.
- **Schema migrations**: run `npx prisma migrate deploy` (already executed on container start).
- **Backups**: Configure Postgres WAL backups / snapshots; for Redis persistent deployments, enable AOF.
- **Secrets rotation**: Rotate JWT secrets and Redis/Postgres credentials; update deployment environment variables and restart.
- **Scaling**: For Kubernetes, adjust Deployment replicas or apply HPA configuration (see `docs/ops/kubernetes` samples).

## Environment toggles

- `NODE_ENV`: `production` for prod; `development` for local.
- `METRICS_ENABLED`: enable Prometheus metrics.
- `METRICS_GUARD`, `METRICS_GUARD_SECRET`, `METRICS_GUARD_ALLOWLIST`: guard metrics endpoint.
- `CORS_ORIGINS`: comma-separated allowlist; must be set for production.
- `TRUST_PROXY`: Express `trust proxy` directive; default is `loopback`. Set to the number of proxy hops or a CIDR list that matches your ingress so client IPs are preserved for rate limiting and CIDR guards.
- `RATE_LIMIT_REDIS_URL`: configure Redis connection; absence disables Redis-backed rate limiting.
- Auth toggles: `AUTH_EMAIL_VERIFICATION_REQUIRED`, `AUTH_LOGIN_*` to adjust lockout thresholds.
