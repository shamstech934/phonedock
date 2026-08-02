# SpecsDekh v28.5 — Enterprise SEO Final Phase

- `/sitemap.xml` is now a standards-compliant sitemap index.
- Dedicated phone, brand, news, review, image and video sitemaps.
- Database-backed sitemap routes are request-time and failure-safe, so temporary Atlas errors do not fail builds.
- IndexNow secure submission endpoint: `POST /api/indexnow` with `x-cron-secret`.
- IndexNow key route: `/indexnow-key.txt` using `INDEXNOW_KEY`.
- Existing Bing verification XML remains in `/public/BingSiteAuth.xml`.

## Environment variable
Add `INDEXNOW_KEY` in Vercel and GitHub. Use a random 32–64 character alphanumeric value.
