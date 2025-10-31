# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Comprehensive documentation suite (CONTRIBUTING.md, SECURITY.md, CHANGELOG.md)
- Automated dependency management with Renovate Bot
- Structured logging with Pino throughout application
- Email service integration (SMTP and console fallback)
- Git hooks for code quality (Husky + lint-staged)
- Environment configuration validation and documentation

## [1.0.0] - 2024-10-31

### Added

#### Core Features

- **Authentication & Authorization**
  - JWT-based authentication with access/refresh token rotation
  - Argon2id password hashing with secure defaults
  - Email verification flow (optional, configurable)
  - Password reset with secure token generation
  - Session management with database persistence
  - Login lockout after failed attempts (configurable thresholds)
  - Role-based access control (RBAC) middleware

#### API & Middleware

- RESTful API with Express 5.x
- Zod schema validation for all inputs
- CORS with configurable origin allowlist (strict in production)
- Rate limiting (memory-based dev, Redis-backed production)
- Helmet security headers
- Request body size limits (100kb default)
- Error handling with consistent error codes
- Request correlation IDs (`x-request-id`)

#### Database

- Prisma ORM with PostgreSQL 15
- User and Session models with proper relations
- Database migrations with version control
- Automatic Prisma Client generation
- Connection pooling and error handling

#### Observability

- **Logging**
  - Structured JSON logs with Pino
  - Per-request correlation IDs
  - Automatic redaction of sensitive data
  - Pretty-printing in development
  - Configurable log levels

- **Metrics**
  - Prometheus metrics endpoint (`/metrics`)
  - HTTP request duration and count
  - Node.js process metrics
  - Guard mechanisms (secret-based or CIDR allowlist)
  - Disabled by default in production

- **Health Checks**
  - Liveness probe (`/health`)
  - Readiness probe (`/ready`) with database connectivity
  - Build metadata endpoint (`/version`)

#### API Documentation

- OpenAPI 3.1 specification
- Swagger UI integration (`/docs` in non-production)
- Automated spec generation from Zod schemas
- JSON spec endpoint (`/openapi.json`)

#### Development Experience

- **TypeScript**
  - Strict mode enabled
  - ES modules (`.js` imports)
  - Source maps for debugging
  - Path aliases configured

- **Testing**
  - Vitest test framework
  - Supertest for API testing
  - Coverage reporting with v8
  - Thresholds: 85% lines/functions, 80% branches, 70% statements
  - Isolated test database
  - Test utilities and fixtures

- **Code Quality**
  - ESLint with TypeScript rules
  - Prettier formatting (ready to integrate)
  - Import order enforcement
  - Max warnings = 0 in CI
  - Git hooks (pre-commit: lint, pre-push: test)

- **Development Tools**
  - Hot reload with `tsx watch`
  - Docker Compose for local services
  - Environment file templates
  - Build metadata stamping
  - Secret scanning script

#### DevOps & Deployment

- **Docker**
  - Multi-stage Dockerfile (builder → runner)
  - Non-root user
  - Health checks
  - Production-optimized image
  - Docker Compose for local and production

- **CI/CD**
  - GitHub Actions workflow
  - Automated testing on PR/push
  - Coverage reporting
  - OpenAPI spec artifact
  - License checking
  - Dependency auditing

- **Kubernetes**
  - Deployment manifest
  - Service definition
  - ConfigMap for configuration
  - Secret management
  - Horizontal Pod Autoscaler (HPA)
  - Probes configured

#### Documentation

- Comprehensive README with quickstart
- Environment variable reference
- Troubleshooting guide
- API documentation
- Operational runbook (`docs/ops/runbook.md`)
- Kubernetes deployment guide
- Development guide (`docs/DEVELOPMENT.md`)
- Renovate configuration guide (`docs/RENOVATE.md`)

### Security

- **Authentication**
  - Secure JWT implementation with RS256/HS256 support
  - Short-lived access tokens (15 minutes default)
  - Rotating refresh tokens (7 days default)
  - Token invalidation on logout
  - Session revocation capability

- **Password Security**
  - Argon2id hashing (memory-hard, GPU-resistant)
  - Configurable work factors
  - Secure password reset flow
  - Token expiry and single-use enforcement

- **Input Validation**
  - Zod schema validation for all inputs
  - Email format validation
  - Password complexity rules
  - Request size limits

- **Network Security**
  - CORS with strict origin validation in production
  - Helmet security headers
  - Rate limiting per IP and endpoint
  - Request timeout enforcement

- **Data Protection**
  - Sensitive log field redaction
  - Token hashing before database storage
  - No stack traces in production errors
  - Secure session storage

- **Operational Security**
  - Graceful shutdown with connection draining
  - Health checks for reliability
  - Guarded metrics endpoint
  - Environment-based configuration
  - Dependency vulnerability scanning

### Configuration

#### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - Access token signing secret
- `JWT_REFRESH_SECRET` - Refresh token signing secret
- `CORS_ORIGINS` - Allowed origins (production)
- `RATE_LIMIT_REDIS_URL` - Redis URL (production)

#### Optional Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_ACCESS_EXPIRY` - Access token lifetime (default: 15m)
- `JWT_REFRESH_EXPIRY` - Refresh token lifetime (default: 7d)
- `LOG_LEVEL` - Logging level (default: info)
- `METRICS_ENABLED` - Enable Prometheus metrics (default: false in prod)
- `AUTH_EMAIL_VERIFICATION_REQUIRED` - Require email verification (default: false)
- `AUTH_EMAIL_VERIFICATION_TTL_MINUTES` - Email token TTL (default: 60)
- `AUTH_PASSWORD_RESET_TTL_MINUTES` - Password reset token TTL (default: 30)
- `AUTH_LOGIN_MAX_ATTEMPTS` - Max failed logins (default: 5)
- `AUTH_LOGIN_LOCKOUT_MINUTES` - Lockout duration (default: 15)
- Plus SMTP configuration for email service

### Dependencies

#### Production

- `express` ^5.1.0 - Web framework
- `@prisma/client` ^6.17.1 - Database ORM
- `jsonwebtoken` ^9.0.2 - JWT handling
- `argon2` ^0.44.0 - Password hashing
- `zod` ^4.1.12 - Schema validation
- `pino` 10.0.0 - Structured logging
- `helmet` ^8.1.0 - Security headers
- `cors` ^2.8.5 - CORS middleware
- `express-rate-limit` ^8.1.0 - Rate limiting
- `nodemailer` ^7.0.10 - Email sending
- Plus supporting libraries

#### Development

- `typescript` ^5.9.3 - Type system
- `vitest` ^3.2.4 - Testing framework
- `eslint` ^9.38.0 - Linting
- `husky` ^9.1.7 - Git hooks
- `prisma` ^6.17.1 - Database toolkit
- Plus testing and tooling dependencies

### Infrastructure

- **Node.js**: 20.x LTS (20.19.0+)
- **PostgreSQL**: 15.x
- **Redis**: 7.x (production rate limiting)
- **Docker**: 24.x+
- **Docker Compose**: 2.x+

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version: Incompatible API changes
- **MINOR** version: Backwards-compatible functionality
- **PATCH** version: Backwards-compatible bug fixes

### Release Checklist

Before releasing a new version:

- [ ] Update `CHANGELOG.md` with all changes
- [ ] Update version in `package.json`
- [ ] Run full test suite (`npm run check`)
- [ ] Update documentation if needed
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Create GitHub release with changelog excerpt
- [ ] Attach `openapi.json` artifact to release

## Migration Guides

### Upgrading to 1.0.0

This is the initial stable release. If you're using a pre-1.0 version:

1. **Review breaking changes** in your fork
2. **Update environment variables** - new variables added:
   - Email service configuration (SMTP)
   - Auth configuration (verification, lockout settings)
   - Structured logging configuration
3. **Run database migrations**: `npx prisma migrate deploy`
4. **Update dependencies**: `npm install`
5. **Test thoroughly** before deploying to production

## Deprecation Policy

- **Notice Period**: 3 months minimum for breaking changes
- **Communication**: Announced in CHANGELOG and GitHub releases
- **Migration Path**: Always provided for deprecated features

---

## Version History

### [1.0.0] - 2024-10-31

- Initial stable release
- Production-ready authentication and API
- Comprehensive test coverage (89%+)
- Full documentation suite
- DevOps tooling and CI/CD

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## Security

See [SECURITY.md](./SECURITY.md) for our security policy and how to report vulnerabilities.

## License

This project is licensed under the ISC License - see the [LICENSE](./LICENSE) file for details.

---

**Note:** This changelog is maintained manually. Automated changelog generation is planned for future releases via Renovate and semantic-release.
