# Security Policy

This starter aims to be secure by default while staying lightweight. It ships sensible defaults such as JWT rotation, rate limiting, helmet, and basic email verification, but you are responsible for operating it with strong secrets, TLS termination, and hardened infrastructure.

## Supported versions

- **main branch / latest release:** receives security updates and fixes.
- **older tags:** not actively maintained; upgrade to the latest release to stay covered.

## Reporting a vulnerability

- **Prefer private advisories:** Open a [GitHub Security Advisory](https://github.com/lucanovello/starter-express-prisma-jwt/security/advisories/new) with reproduction steps, affected endpoints, logs, and impact.
- **No public issues for security:** Avoid filing vulnerabilities as public issues or discussions.
- **If advisories are not an option:** Contact the maintainer privately through GitHub to arrange an alternate secure channel.

## Responsible disclosure expectations

- We acknowledge reports within **3 business days** and provide an initial triage or reproduction plan within **5 business days**.
- We will coordinate on a fix timeline, regression tests, and disclosure timing. Please allow time for a patched release before any public disclosure.
- If secrets (SMTP/API credentials, JWT keys, database passwords) are exposed, rotate them immediately and note the exposure path in your report so mitigation steps can be verified.
- Exploit attempts against production environments are out of scope; please limit testing to staging or locally controlled deployments.
