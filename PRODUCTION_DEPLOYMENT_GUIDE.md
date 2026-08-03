# Production Deployment Guide

## Runtime

- Use Node.js 22 LTS by default.
- The package manifest also describes the supported Node 24 LTS line for CI compatibility.

## Clean verification

```bash
npm ci --include=dev
npm run release:gate
```

Do not deploy if the release gate fails.

## Vercel

1. Import the repository.
2. Use the repository root as the project root.
3. Set the Node runtime to 22.
4. Add all required environment variables from `.env.example`.
5. Deploy and inspect Function, Cron, and Build logs.
6. Confirm all configured domains show Valid Configuration.

## Post-deployment smoke test

- Home, Phones, Phone Detail, Compare, Rankings, Brands, Reviews, Search
- Admin login and dashboard
- Phone and brand create/edit/save
- Price source setup, test, auto-link, and run-sync
- Data Quality refresh/full scan
- Import preview/apply/history
- Cron authorization and last-run state

## Rollback

Keep the previous successful Vercel deployment available. If a critical problem appears, promote the previous deployment and preserve database logs before attempting repair.
