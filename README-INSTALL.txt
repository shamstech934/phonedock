PhoneDock Phase 3 - Collector to Price Tracker Bridge
=====================================================

IMPORTANT: This is a small PATCH, not a complete project.

Install:
1. Open the ZIP.
2. Copy everything inside it.
3. Paste into the root of your CURRENT GitHub project (the folder containing package.json).
4. Choose Replace when Windows asks about the included files.
5. Do not delete or replace your complete project folder.
6. Commit and push through GitHub Desktop, then let Vercel deploy.

What this patch does:
- Collector jobs automatically queue exact product records for Price Tracker review.
- Only approved, imported, or high-confidence exact-slug phone matches auto-link.
- Fuzzy matches never auto-link.
- Collected prices remain pending until the genuine retailer product page is verified.
- Untrusted domains create a source-gap review item instead of changing a live price.
- Older untested auto-linked listings are repaired back to pending.
- Collector jobs save price candidate, queued, source-gap, and skipped counters.
- Approved collector imports retain their original source URL.

After deployment:
1. Run a Collector sync, or open Price Tracker and click Auto-link catalog.
2. Review Pending Review / Source Gaps.
3. Run price sync only after trusted sources have genuine product URLs.

Verification performed before packaging:
- npm run typecheck: PASS
- changed-file ESLint: PASS (0 warnings)
- npm test: PASS
- npm run build: PASS

Known existing project issue (not introduced by this patch):
- Full-project direct ESLint reports the pre-existing React try/catch error in src/app/brands/page.tsx and legacy warnings. Changed files are clean.
