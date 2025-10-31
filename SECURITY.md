# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

**Note:** We strongly recommend always using the latest version to ensure you have all security patches.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

We take security seriously and appreciate your efforts to responsibly disclose vulnerabilities. If you discover a security issue, please report it privately.

### How to Report

1. **GitHub Security Advisories** (Preferred):
   - Go to the [Security tab](https://github.com/lucanovello/starter-express-prisma-jwt/security/advisories)
   - Click "Report a vulnerability"
   - Fill out the form with as much detail as possible

2. **Email** (Alternative):
   - Send details to: [INSERT_SECURITY_EMAIL]
   - Use subject line: `[SECURITY] Brief description`
   - Encrypt sensitive information if possible (PGP key available on request)

### What to Include

Please provide the following information:

- **Type of vulnerability** (e.g., XSS, SQL injection, JWT bypass)
- **Full paths** of affected source files
- **Location** of the vulnerability (file, line number, or URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept** or exploit code (if possible)
- **Impact assessment** (what an attacker could achieve)
- **Suggested fix** (if you have one)
- **Your name/handle** (for credit, if desired)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Confirmation**: Within 7 days (we'll confirm if it's a valid issue)
- **Fix Timeline**: Depends on severity (see below)
- **Disclosure**: Coordinated disclosure after fix is released

### Severity Levels

| Severity | Response Time | Examples                                      |
| -------- | ------------- | --------------------------------------------- |
| Critical | 24-48 hours   | RCE, authentication bypass, data exposure     |
| High     | 7 days        | XSS, CSRF, privilege escalation               |
| Medium   | 30 days       | Information disclosure, DoS                   |
| Low      | 90 days       | Minor information leaks, non-exploitable bugs |

## Security Best Practices

### For Users of This Project

#### Environment Variables

**Always secure your environment variables:**

```bash
# ❌ BAD - Weak secrets
JWT_ACCESS_SECRET=secret
JWT_REFRESH_SECRET=password123

# ✅ GOOD - Strong, random secrets (32+ characters)
JWT_ACCESS_SECRET=REPLACE_WITH_RANDOM_HEX_STRING_32_BYTES_OR_MORE
JWT_REFRESH_SECRET=REPLACE_WITH_DIFFERENT_RANDOM_HEX_STRING_32_BYTES
```

**Generate strong secrets:**

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

#### Production Configuration

**Required security settings for production:**

```env
# CORS - Explicit allowlist (never use wildcards)
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Rate Limiting - Use Redis for distributed systems
RATE_LIMIT_REDIS_URL=redis://your-redis-server:6379

# Metrics - Guard access to Prometheus metrics
METRICS_ENABLED=true
METRICS_GUARD=secret
METRICS_GUARD_SECRET=<YOUR_STRONG_SECRET_HERE>

# Email Verification - Require verified emails
AUTH_EMAIL_VERIFICATION_REQUIRED=true

# Database - Use strong credentials
DATABASE_URL=postgresql://user:strong_password@host:5432/db?sslmode=require
```

#### TLS/SSL

**Always use HTTPS in production:**

- Deploy behind a TLS-terminating reverse proxy (nginx, Cloudflare, AWS ALB)
- Enable HSTS headers at your edge
- Use valid SSL certificates (Let's Encrypt is free)
- Configure `trust proxy` in Express if behind a proxy

#### Database Security

**Secure your database:**

- Use strong, unique passwords
- Enable SSL/TLS connections (`?sslmode=require`)
- Restrict network access (firewall rules, security groups)
- Regular backups with encryption
- Keep PostgreSQL updated

#### Dependency Management

**Keep dependencies up-to-date:**

- This project uses Renovate for automated updates
- Security patches are applied immediately
- Review and merge Renovate PRs regularly
- Monitor GitHub Security Advisories

#### Docker Security

**Harden Docker deployments:**

```dockerfile
# Use specific version tags, not 'latest'
FROM node:20.19.0-alpine

# Run as non-root user
USER node

# Minimize attack surface
RUN apk --no-cache add dumb-init

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
```

**Docker Compose security:**

```yaml
# Use secrets for sensitive data
secrets:
  jwt_access_secret:
    external: true
  jwt_refresh_secret:
    external: true

services:
  api:
    secrets:
      - jwt_access_secret
      - jwt_refresh_secret
```

### For Contributors

#### Secure Coding Practices

**Input Validation:**

```typescript
// ✅ GOOD - Use Zod schemas for validation
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});
```

**SQL Injection Prevention:**

```typescript
// ✅ GOOD - Prisma prevents SQL injection
const user = await prisma.user.findUnique({
  where: { email },
});

// ❌ BAD - Never use raw SQL with user input
// const user = await prisma.$queryRaw`SELECT * FROM users WHERE email = '${email}'`;
```

**Password Hashing:**

```typescript
// ✅ GOOD - Use Argon2 (already configured)
import { hashPassword } from "./lib/password.js";
const hashedPassword = await hashPassword(plainPassword);

// ❌ BAD - Never store passwords in plain text
// user.password = plainPassword;
```

**JWT Security:**

```typescript
// ✅ GOOD - Short-lived access tokens
JWT_ACCESS_EXPIRY=15m // 15 minutes

// ❌ BAD - Long-lived access tokens
// JWT_ACCESS_EXPIRY=30d
```

**Error Handling:**

```typescript
// ✅ GOOD - Don't expose internal errors
catch (error) {
  logger.error({ err: error }, 'Database error');
  throw new InternalServerError('Operation failed');
}

// ❌ BAD - Exposing stack traces
// catch (error) {
//   res.status(500).json({ error: error.stack });
// }
```

**Rate Limiting:**

```typescript
// ✅ GOOD - Already configured for auth endpoints
// See src/middleware/security.ts

// Consider adding rate limits for:
// - Password reset requests
// - Email verification resends
// - API endpoints with expensive operations
```

#### Secrets in Code

**Never commit secrets:**

```bash
# Add to .gitignore
.env
.env.local
.env.production
*.pem
*.key
secrets/
```

**Scan for secrets:**

```bash
# Run secret scanner (already in CI)
npm run scan:secrets
```

#### Dependency Audits

**Check for vulnerabilities:**

```bash
# Audit dependencies
npm audit

# Fix automatically (if possible)
npm audit fix

# Review high/critical vulnerabilities
npm audit --audit-level=high
```

## Known Security Features

This project implements several security best practices:

### Authentication & Authorization

- ✅ **JWT with rotation**: Access tokens expire quickly, refresh tokens enable rotation
- ✅ **Argon2 password hashing**: Memory-hard algorithm resistant to GPU attacks
- ✅ **Session management**: Database-backed sessions with revocation
- ✅ **Email verification**: Optional verification flow for new accounts
- ✅ **Password reset**: Secure token-based password reset with expiry
- ✅ **Login lockout**: Temporary lockout after failed attempts

### API Security

- ✅ **CORS**: Configurable origin allowlist (strict in production)
- ✅ **Rate limiting**: Per-IP and per-endpoint limits (Redis-backed in production)
- ✅ **Helmet**: Security headers (CSP, HSTS candidates, X-Frame-Options, etc.)
- ✅ **Request size limits**: Body size capped to prevent DoS
- ✅ **Input validation**: Zod schemas validate all user input
- ✅ **Error handling**: Consistent error responses, no stack traces in production

### Data Protection

- ✅ **Password hashing**: Argon2id with secure defaults
- ✅ **Token hashing**: Sensitive tokens hashed before database storage
- ✅ **Log redaction**: Sensitive fields automatically redacted from logs
- ✅ **Secure headers**: Helmet middleware adds security headers

### Infrastructure

- ✅ **Docker**: Multi-stage builds, non-root user
- ✅ **Health checks**: Liveness and readiness probes
- ✅ **Graceful shutdown**: Proper signal handling, connection draining
- ✅ **Dependency updates**: Automated via Renovate Bot

## Security Considerations

### Known Limitations

1. **Session Storage**:
   - Sessions stored in PostgreSQL (not Redis)
   - Consider Redis for high-traffic applications
   - Implement session cleanup job (`src/jobs/sessionCleanup.ts`)

2. **Rate Limiting**:
   - Memory-based in dev/test (not distributed)
   - Requires Redis in production for multi-instance deployments
   - Consider additional WAF/CDN-level rate limiting

3. **Email Verification**:
   - Optional by default (`AUTH_EMAIL_VERIFICATION_REQUIRED=false`)
   - Enable in production for additional security
   - Tokens sent via email (ensure SMTP security)

4. **CORS**:
   - Permissive in dev/test for easier development
   - Requires explicit allowlist in production
   - Same-origin requests bypass CORS (by design)

### Threat Model

**In Scope:**

- Authentication/authorization bypasses
- Injection attacks (SQL, NoSQL, XSS, etc.)
- Cryptographic weaknesses
- Session management issues
- Information disclosure
- Denial of Service (application-level)

**Out of Scope:**

- DDoS attacks (use CDN/WAF)
- Physical access to servers
- Social engineering
- Browser/OS vulnerabilities
- Network-level attacks (use firewalls)

## Security Updates

### Staying Informed

- **Watch this repository** for security advisories
- **Enable GitHub security alerts** for your fork
- **Subscribe to PostgreSQL security announcements**
- **Follow Node.js security releases**

### Applying Updates

**For security patches:**

```bash
# Update to latest version
git pull origin main

# Install updated dependencies
npm install

# Run migrations (if any)
npx prisma migrate deploy

# Restart application
npm run build && npm start
```

**For Renovate users:**

- Security PRs are created immediately (no waiting period)
- Labeled with `security` and `high-priority`/`critical`
- Review and merge promptly

## Disclosure Policy

We follow **coordinated disclosure**:

1. **Report received**: We acknowledge receipt within 48 hours
2. **Investigation**: We confirm and assess the vulnerability
3. **Fix development**: We develop and test a fix
4. **Private disclosure**: We share fix with reporter for verification
5. **Public disclosure**: We release fix and security advisory
6. **Credit**: We credit the reporter (if desired)

**Typical timeline:** 7-90 days depending on severity and complexity.

**Exceptions:** We may accelerate disclosure if:

- The vulnerability is being actively exploited
- Details are publicly disclosed by others
- A fix is trivial and can be deployed immediately

## Bug Bounty

We currently **do not** have a bug bounty program. However:

- We greatly appreciate security reports
- We will credit you in our security advisories (if desired)
- We may consider recognition/swag for significant findings

## Security Hall of Fame

We recognize security researchers who help us improve:

_No security issues reported yet. Be the first!_

<!--
### 2024
- [Researcher Name] - Description of finding
-->

## Questions?

For questions about this security policy:

- Open a [discussion](https://github.com/lucanovello/starter-express-prisma-jwt/discussions) (for non-sensitive questions)
- Email [INSERT_SECURITY_EMAIL] (for sensitive matters)

---

**Thank you for helping keep this project secure!** 🔒
