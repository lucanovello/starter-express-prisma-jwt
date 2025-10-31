# Dependency Automation with Renovate

This project uses [Renovate](https://docs.renovatebot.com/) for automated dependency management. Renovate automatically creates pull requests to update dependencies, helping keep the project secure and up-to-date.

## Configuration Overview

Our Renovate configuration (`renovate.json`) implements a **balanced approach** between automation and safety:

### Core Philosophy

- **Automate the safe stuff**: Patch and minor updates auto-merge after a stability period
- **Manual review for breaking changes**: Major updates require human approval
- **Security first**: Critical security fixes merge immediately without waiting
- **Maintain stability**: 3-day waiting period for non-security updates

## Update Policy

### Auto-Merge (Automatic)

✅ **Patch updates** (e.g., 1.2.3 → 1.2.4)

- Stability period: 3 days
- Auto-merge: Yes (after tests pass)
- Example: Bug fixes, security patches

✅ **Minor updates** (e.g., 1.2.0 → 1.3.0)

- Stability period: 3 days
- Auto-merge: Yes (after tests pass)
- Example: New features (backwards compatible)

✅ **Security fixes** (High/Critical severity)

- Stability period: None (immediate)
- Auto-merge: Yes (after tests pass)
- Prioritized over regular updates

### Manual Review (Requires Approval)

⚠️ **Major updates** (e.g., 1.0.0 → 2.0.0)

- Stability period: N/A
- Auto-merge: No
- Label: `major-update`
- Reason: May contain breaking changes

### Disabled Updates

🚫 **Pinned major versions**:

- `express` - Stable at v5.x
- `prisma` / `@prisma/client` - Major updates reviewed manually

These can be enabled when you're ready to migrate.

## Schedule

### Regular Updates

- **Day**: Monday (before 6am)
- **Frequency**: Weekly
- **Reason**: Gives you the start of the week to review changes

### Security Updates

- **Schedule**: Any time (24/7)
- **Reason**: Security issues should be addressed immediately

### Lock File Maintenance

- **Schedule**: First day of each month (before 3am)
- **Action**: Dedupe and refresh lock file
- **Auto-merge**: Yes

## Grouped Updates

Dependencies are intelligently grouped to reduce PR noise:

| Group              | Packages                                     |
| ------------------ | -------------------------------------------- |
| **TypeScript**     | `typescript`, `@types/*`                     |
| **ESLint**         | `eslint`, `eslint-*`, `@typescript-eslint/*` |
| **Vitest**         | `vitest`, `@vitest/*`                        |
| **Prisma**         | `prisma`, `@prisma/client`                   |
| **Pino**           | `pino`, `pino-http`, `pino-pretty`           |
| **GitHub Actions** | All workflow actions                         |

## Quality Gates

All PRs must pass these checks before auto-merge:

1. ✅ **Tests**: All 75+ tests must pass
2. ✅ **Coverage**: Maintain 85%+ thresholds
3. ✅ **TypeScript**: No compilation errors
4. ✅ **ESLint**: No warnings (max-warnings=0)
5. ✅ **Git Hooks**: Pre-commit and pre-push checks

## Labels

Renovate applies these labels automatically:

| Label           | Meaning                              |
| --------------- | ------------------------------------ |
| `dependencies`  | All dependency updates               |
| `renovate`      | Created by Renovate bot              |
| `major-update`  | Major version bump (requires review) |
| `security`      | Security vulnerability fix           |
| `high-priority` | High severity security issue         |
| `critical`      | Critical security vulnerability      |

## Customization

### Add Assignees/Reviewers

Edit `renovate.json`:

```json
{
  "assignees": ["your-github-username"],
  "reviewers": ["team-member-1", "team-member-2"]
}
```

### Adjust Stability Period

Change `stabilityDays` for more/less conservative updates:

```json
{
  "stabilityDays": 7 // Wait 1 week instead of 3 days
}
```

### Enable Major Updates for Specific Packages

Remove from the disabled list:

```json
{
  "packageRules": [
    {
      "matchPackageNames": ["express"], // Remove this line
      "matchUpdateTypes": ["major"],
      "enabled": false
    }
  ]
}
```

### Disable Auto-Merge

If you prefer to review everything manually:

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["patch", "minor"],
      "automerge": false // Change to false
    }
  ]
}
```

## Dashboard

Renovate creates a **Dependency Dashboard** issue with:

- Overview of all pending updates
- Updates that failed
- Updates that are rate-limited
- Configuration warnings

Check the dashboard regularly: `Issues → Dependency Dashboard`

## First Time Setup

### For GitHub

1. **Install Renovate App**:
   - Go to: https://github.com/apps/renovate
   - Click "Install" or "Configure"
   - Select this repository

2. **Verify Configuration**:
   - Renovate will create an onboarding PR
   - Review and merge it
   - Regular updates will start automatically

### For GitLab

Add to `.gitlab-ci.yml`:

```yaml
renovate:
  image: renovate/renovate:latest
  script:
    - renovate
  only:
    - schedules
```

### For Self-Hosted

Run Renovate as a cron job:

```bash
npm install -g renovate
renovate --platform=github --token=$GITHUB_TOKEN
```

## Monitoring

### Check PR Status

Renovate PRs follow this pattern:

```
chore(deps): update dependency-name to v1.2.3
```

### Review Failed Updates

Check the Dependency Dashboard for:

- ❌ Updates that failed tests
- ⏸️ Updates that are paused
- 🔒 Updates blocked by constraints

### Logs

Renovate logs are available in:

- PR comments (build status)
- Dependency Dashboard issue
- CI/CD pipeline logs

## Troubleshooting

### Update Not Created

**Possible reasons**:

1. Package is in `ignoreDeps` list
2. Update doesn't match schedule
3. Rate limit reached (`prConcurrentLimit: 5`)
4. Stability period not met (3 days)

**Solution**: Check Dependency Dashboard for details

### Auto-Merge Failed

**Possible reasons**:

1. Tests failed
2. Coverage dropped below threshold
3. Lint/typecheck errors
4. Merge conflicts

**Solution**: Review PR and fix failing checks

### Too Many PRs

**Reduce PR volume**:

1. Increase `stabilityDays`
2. Add more package groups
3. Lower `prConcurrentLimit`
4. Adjust schedule (less frequent)

### Security Update Not Immediate

**Check**:

1. Is `vulnerabilityAlerts.enabled` set to `true`?
2. Does package have known vulnerability?
3. Check `minimumReleaseAge` for security rules

## Best Practices

### ✅ Do

- Review major updates carefully
- Check changelogs for breaking changes
- Test locally before merging major updates
- Keep Renovate config in sync with project needs
- Monitor the Dependency Dashboard weekly

### ❌ Don't

- Ignore security updates
- Auto-merge major updates blindly
- Disable tests for faster merges
- Skip reading changelogs
- Leave PRs open for too long (causes conflicts)

## Integration with Git Hooks

Renovate PRs automatically trigger:

1. **Pre-commit** (via Husky):
   - ESLint auto-fix
   - Prettier formatting
   - Staged files only

2. **Pre-push** (via Husky):
   - TypeScript compilation
   - Full test suite
   - Coverage validation

This ensures all PRs meet quality standards before auto-merge.

## Cost Considerations

### Free Tier (GitHub)

- ✅ Public repositories: Free unlimited
- ✅ Private repositories: Free for open source

### Self-Hosted

- Cost: Server infrastructure only
- Benefit: Full control over schedule and resources

## Security Features

### Vulnerability Alerts

- Immediate updates for high/critical severity
- No stability waiting period
- Special labels for visibility
- Prioritized over regular updates

### Dependency Pinning

- Docker images pinned to SHA digests
- Prevents tag hijacking
- Ensures reproducible builds

### Lock File Integrity

- Monthly maintenance updates
- Deduplication to reduce bloat
- Ensures consistency across environments

## Support

### Documentation

- Renovate Docs: https://docs.renovatebot.com/
- Configuration Reference: https://docs.renovatebot.com/configuration-options/
- Presets: https://docs.renovatebot.com/presets/

### Community

- GitHub Discussions: https://github.com/renovatebot/renovate/discussions
- Discord: https://discord.gg/renovate

### Issues

For project-specific questions, check:

1. Dependency Dashboard issue
2. Renovate PR comments
3. CI/CD logs

## Version

This configuration is compatible with:

- Renovate v37+
- GitHub Actions
- npm/pnpm/yarn package managers
- Docker
- Node.js LTS

Last updated: 2025-10-31
