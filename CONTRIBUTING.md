# Contributing to Starter Express + Prisma + JWT

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Documentation](#documentation)
- [Security Issues](#security-issues)
- [Questions and Support](#questions-and-support)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone. We pledge to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Our Standards

Examples of behavior that contributes to a positive environment:

- Demonstrating empathy and kindness toward other people
- Being respectful of differing opinions, viewpoints, and experiences
- Giving and gracefully accepting constructive feedback
- Accepting responsibility and apologizing to those affected by our mistakes
- Focusing on what is best not just for us as individuals, but for the overall community

Examples of unacceptable behavior:

- The use of sexualized language or imagery, and unwanted sexual attention or advances
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js 20.x** (LTS) - Use [nvm](https://github.com/nvm-sh/nvm) or see `.nvmrc`
- **Docker & Docker Compose** - For local Postgres/Redis
- **Git** - For version control
- **npm** - Package manager (comes with Node.js)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/starter-express-prisma-jwt.git
   cd starter-express-prisma-jwt
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/lucanovello/starter-express-prisma-jwt.git
   ```

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Start local database
docker compose up -d db

# Setup database schema
npx prisma generate
npx prisma migrate deploy
```

### Verify Setup

```bash
# Run tests to verify everything works
npm test

# Start development server
npm run dev
```

Visit http://localhost:3000/health - you should see `{"status":"ok"}`.

## Development Workflow

### Branch Strategy

We use a feature branch workflow:

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `chore/*` - Maintenance tasks

### Create a Feature Branch

```bash
# Update your local main branch
git checkout main
git pull upstream main

# Create and checkout a new feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Make your changes** in your feature branch
2. **Follow coding standards** (see below)
3. **Write/update tests** for your changes
4. **Run tests locally**:

   ```bash
   npm run check  # Runs typecheck + lint + tests
   ```

5. **Commit your changes** (see commit guidelines below)

### Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) for git hooks:

- **Pre-commit**: Runs ESLint auto-fix and Prettier formatting on staged files
- **Pre-push**: Runs TypeScript compilation and full test suite

These hooks ensure code quality before pushing. They run automatically when you commit/push.

### Keep Your Branch Updated

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase your branch on upstream/main
git rebase upstream/main

# Resolve conflicts if any, then continue
git rebase --continue

# Force push to your fork (only if needed after rebase)
git push origin feature/your-feature-name --force-with-lease
```

## Pull Request Process

### Before Submitting

Ensure your PR meets these requirements:

- [ ] Code follows the project's coding standards
- [ ] All tests pass (`npm test`)
- [ ] Test coverage meets thresholds (85%+ lines/functions)
- [ ] TypeScript compilation is clean (`npm run typecheck`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Relevant documentation is updated
- [ ] Commit messages follow guidelines
- [ ] No merge conflicts with `main`

### Submitting Your PR

1. **Push your branch** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub:
   - Go to the [original repository](https://github.com/lucanovello/starter-express-prisma-jwt)
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template completely

3. **PR Title Format**:

   ```
   feat: add user profile endpoint
   fix: correct JWT expiry validation
   docs: update API documentation
   chore: upgrade dependencies
   ```

4. **PR Description** should include:
   - What changes were made and why
   - Any breaking changes
   - Related issue numbers (e.g., "Fixes #123")
   - Testing instructions
   - Screenshots (if UI changes)

### PR Review Process

1. **Automated Checks**: CI will run tests, linting, and coverage
2. **Code Review**: Maintainers will review your code
3. **Requested Changes**: Address any feedback and push updates
4. **Approval**: Once approved, a maintainer will merge your PR

### After Your PR is Merged

1. **Delete your feature branch**:

   ```bash
   git branch -d feature/your-feature-name
   git push origin --delete feature/your-feature-name
   ```

2. **Update your local main**:

   ```bash
   git checkout main
   git pull upstream main
   ```

## Coding Standards

### TypeScript

- Use **strict mode** (enabled in `tsconfig.json`)
- Prefer **interfaces** over type aliases for object shapes
- Use **explicit return types** for public functions
- Avoid `any` - use `unknown` if type is truly dynamic
- Use **optional chaining** (`?.`) and **nullish coalescing** (`??`)

**Example:**

```typescript
interface UserResponse {
  id: string;
  email: string;
  createdAt: Date;
}

async function getUser(id: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ?? null;
}
```

### Code Style

We use **Prettier** and **ESLint** for consistent code formatting:

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Yes (automatic via Prettier)
- **Max line length**: 100 characters (Prettier default: 80)
- **Trailing commas**: ES5 (objects, arrays)

Run formatters:

```bash
npm run lint:fix  # Auto-fix ESLint issues
npm run format    # Format with Prettier (if added)
```

### File Organization

```
src/
├── config/         # Configuration and environment
├── dto/            # Data Transfer Objects (Zod schemas)
├── jobs/           # Background jobs
├── lib/            # Shared utilities (JWT, password, etc.)
├── middleware/     # Express middleware
├── routes/         # API route handlers
├── services/       # Business logic
└── types/          # TypeScript type definitions
```

### Naming Conventions

- **Files**: `camelCase.ts` for modules, `PascalCase.ts` for classes
- **Variables/Functions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: Prefix with `_` if needed

**Example:**

```typescript
const MAX_RETRY_ATTEMPTS = 3; // Constant
class AuthService {} // Class
interface UserSession {} // Interface
function validateToken() {} // Function
```

### Error Handling

- Use custom error classes from `src/lib/errors.ts`
- Always include error codes for API errors
- Never expose internal error details to clients in production

**Example:**

```typescript
import { UnauthorizedError } from "../lib/errors.js";

if (!isValid) {
  throw new UnauthorizedError("Invalid credentials", "INVALID_CREDENTIALS");
}
```

### Async/Await

- Prefer `async`/`await` over raw promises
- Always handle errors with try/catch
- Use `Promise.all()` for concurrent operations

**Example:**

```typescript
async function fetchUserData(userId: string) {
  try {
    const [user, sessions] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.session.findMany({ where: { userId } }),
    ]);
    return { user, sessions };
  } catch (error) {
    logger.error({ err: error, userId }, "Failed to fetch user data");
    throw new InternalServerError("Failed to fetch user data");
  }
}
```

## Testing Guidelines

### Test Structure

We use **Vitest** for testing. Tests should:

- Be isolated and independent
- Clean up after themselves
- Use descriptive names
- Follow Arrange-Act-Assert pattern

**Example:**

```typescript
describe("AuthService", () => {
  describe("register", () => {
    it("should create a new user with hashed password", async () => {
      // Arrange
      const email = "test@example.com";
      const password = "SecurePass123!";

      // Act
      const user = await authService.register(email, password);

      // Assert
      expect(user.email).toBe(email);
      expect(user.password).not.toBe(password); // Should be hashed
      expect(user.id).toBeDefined();
    });
  });
});
```

### Test Coverage

Maintain minimum coverage thresholds:

- **Lines**: 85%
- **Functions**: 85%
- **Branches**: 80%
- **Statements**: 70%

Check coverage:

```bash
npm run test:cov
```

### Test Files

- Place tests in `tests/` directory
- Name test files: `feature.test.ts`
- Use `describe` for grouping related tests
- Use `it` or `test` for individual test cases

### Testing Best Practices

1. **Test behavior, not implementation**
2. **One assertion per test** (when possible)
3. **Use meaningful test data** (avoid generic "foo", "bar")
4. **Test edge cases** (null, undefined, empty, large inputs)
5. **Test error conditions** (invalid input, unauthorized access)
6. **Mock external dependencies** (third-party APIs, email services)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- tests/auth.test.ts

# Run tests with coverage
npm run test:cov

# Run all checks (typecheck + lint + test)
npm run check
```

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Changes to build process, dependencies, or tooling
- **ci**: Changes to CI configuration files and scripts

### Scope (Optional)

The scope should be the name of the affected module:

- `auth` - Authentication related
- `prisma` - Database/Prisma changes
- `middleware` - Middleware changes
- `config` - Configuration changes
- `deps` - Dependency updates

### Subject

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize first letter
- No period (.) at the end
- Keep it short (50 chars or less)

### Body (Optional)

- Explain **what** and **why**, not **how**
- Wrap at 72 characters
- Separate from subject with a blank line

### Footer (Optional)

- Reference issues: `Closes #123`, `Fixes #456`
- Note breaking changes: `BREAKING CHANGE: description`

### Examples

**Simple commit:**

```
feat(auth): add password reset endpoint
```

**Commit with body:**

```
fix(middleware): correct CORS origin validation

Previously, the CORS middleware would allow requests from any origin
when CORS_ORIGINS was not set in production. This change enforces
that CORS_ORIGINS must be explicitly configured in production.

Fixes #234
```

**Breaking change:**

```
feat(auth): change JWT payload structure

BREAKING CHANGE: The JWT payload now uses `userId` instead of `sub`
for the user identifier. Existing tokens will need to be reissued.

Migration guide: Update any code that reads `sub` from the JWT
payload to use `userId` instead.
```

## Documentation

### Code Comments

- Use JSDoc for public APIs
- Explain **why**, not **what** (code should be self-explanatory)
- Keep comments up-to-date with code changes

**Example:**

```typescript
/**
 * Generates a password reset token and stores it in the database.
 * The token is hashed before storage for security.
 *
 * @param email - User's email address
 * @returns The plain-text token to send via email
 * @throws UnauthorizedError if user not found or not verified
 */
async function generatePasswordResetToken(email: string): Promise<string> {
  // Implementation...
}
```

### README Updates

Update the README when you:

- Add new environment variables
- Change API endpoints
- Add new features that affect usage
- Update dependencies with breaking changes

### API Documentation

- Update OpenAPI spec in `src/docs/openapi.ts` for API changes
- Regenerate spec: `npm run build && node scripts/generate-openapi.mjs`
- Test endpoints with generated `openapi.json`

### Additional Docs

- Operational guides go in `docs/ops/`
- Architecture decisions in `docs/adr/` (if needed)
- Developer guides in `docs/`

## Security Issues

**Do not open public issues for security vulnerabilities.**

Instead, please report security issues privately:

1. Email: [INSERT_SECURITY_EMAIL] (if available)
2. Or use GitHub's [Security Advisories](https://github.com/lucanovello/starter-express-prisma-jwt/security/advisories/new)

See [SECURITY.md](./SECURITY.md) for our full security policy.

## Questions and Support

### Before Asking

- Check the [README](./README.md)
- Search [existing issues](https://github.com/lucanovello/starter-express-prisma-jwt/issues)
- Review [documentation](./docs/)

### Getting Help

- **Bug reports**: [Open an issue](https://github.com/lucanovello/starter-express-prisma-jwt/issues/new)
- **Feature requests**: [Start a discussion](https://github.com/lucanovello/starter-express-prisma-jwt/discussions)
- **Questions**: [GitHub Discussions](https://github.com/lucanovello/starter-express-prisma-jwt/discussions)

### Issue Guidelines

When opening an issue, include:

- **Clear title** describing the problem
- **Environment details** (Node version, OS, etc.)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Error messages** or logs (if applicable)
- **Code samples** (use markdown code blocks)

**Example:**

````markdown
**Environment:**

- Node: 20.19.0
- OS: Ubuntu 22.04
- Database: PostgreSQL 15

**Steps to reproduce:**

1. Start server with `npm run dev`
2. Send POST request to `/auth/register`
3. Observe error in response

**Expected:** User should be created successfully
**Actual:** Returns 500 Internal Server Error

**Error log:**

```
Error: Connection refused
  at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)
```
````

## Recognition

Contributors will be recognized in several ways:

- Listed in `CHANGELOG.md` for significant contributions
- Mentioned in release notes
- Added to a contributors section (if we add one)

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](./LICENSE) as the project.

## Thank You!

Your contributions make this project better. We appreciate your time and effort! 🙏

---

**Questions about contributing?** Open a [discussion](https://github.com/lucanovello/starter-express-prisma-jwt/discussions) and we'll be happy to help!
