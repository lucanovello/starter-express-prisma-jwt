### What & Why

[brief rationale]

### Changes

- [x] …

### How to test

```bash
cp .env.example .env
docker compose up -d db
npm ci
npx prisma migrate deploy
npm run check
```
