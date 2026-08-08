# PhoneDock

PhoneDock is a Next.js 15 smartphone pricing, specifications, comparison and review platform for the Pakistan market, backed by MongoDB and an admin Data Control system.

## Runtime

- Node.js 22
- npm with committed `package-lock.json`
- Next.js App Router
- MongoDB / Mongoose
- Vercel-compatible serverless runtime

## Production workflow

```bash
npm ci
npm run release:gate
```

The production Vercel profile intentionally has **no automatic cron jobs**. Collector, price sync, data-quality scans and other heavy maintenance actions are manual/admin-triggered so the free-plan CPU allowance is not consumed in the background.

Operational documentation is intentionally limited to the maintained files: `DEPLOYMENT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `ADMIN_GUIDE.md`, `API_REFERENCE.md`, `DEVELOPER_GUIDE.md`, and the small set under `docs/`.
