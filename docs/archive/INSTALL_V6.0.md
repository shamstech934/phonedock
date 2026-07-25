# Install PhoneDock v6.0.0

1. Extract this ZIP over your current PhoneDock project or deploy it as the complete project.
2. Preserve production environment variables, especially `NEXT_PUBLIC_BASE_URL`.
3. Run:

```bash
npm install
npm run test:v6
npm run typecheck
npm run build
```

No database migration is required.

After deployment verify:
- `/opengraph-image`
- `/robots.txt`
- `/sitemap.xml`
- A phone page's canonical and social metadata
- Public APIs return CDN cache headers while `/admin` stays no-store
