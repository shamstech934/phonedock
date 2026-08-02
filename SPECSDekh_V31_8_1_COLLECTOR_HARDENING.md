# SpecsDekh v31.8.1 — Collector Hardening

- Non-product assets (PDF/images/archive/docs/video/audio) are skipped, not counted as failed phone records.
- Collector jobs persist separate error, warning, and skipped-asset counters/logs.
- Productive jobs with warnings complete successfully instead of becoming partially completed.
- RSS/Atom sources are treated as article/monitoring feeds and never fabricated into phone catalog records.
- GSMArena RSS-style `.php3` URLs are detected as RSS feeds.
- Collector Jobs UI shows warnings and skipped assets separately and includes them in downloaded logs.

## Verification

- Collector hardening audit: 10/10 passed
- Production static audit: 98 routes, 0 broken internal links
- Full dependency-backed TypeScript/build must still run in GitHub Actions/Vercel.
