# Contributing

Thanks for improving this starter template. The goal is to keep it lean, production-friendly, and focused on reusable patterns—not to add app-specific features.

## Running the project
- Install dependencies: `npm install`
- Prepare local database + generate Prisma client: `npm run setup:dev`
- Start the API in watch mode: `npm run dev`
- Run the full quality gate before submitting: `npm run check` (typecheck, lint, secret scan, audit, tests)

## What to contribute
- Template-level fixes and improvements (DX, docs, reliability, security).
- Small, focused changes that align with the existing patterns and coding style.
- Prefer updates that help downstream users adapt the template (tests, comments, examples).

## Expectations for PRs
- Keep diffs scoped; describe why the change benefits template users.
- Update or add tests/docs when behavior or guidance changes.
- Ensure `npm run check` passes locally; note any deviations in the PR.
- Avoid embedding project-specific business logic or secrets.
