## Summary

## Commands

```bash
cp .env.example .env
npm ci
npm run dev
```

## Files touched

- src/app.ts
- package.json

## Checklist

- [] Changes scoped to this story
- [] App boots; /health returns 200 and includes x-request-id

## Acceptance criteria

- Clients receive x-request-id on responses
- No Express 5 typing errors (compiles cleanly)
