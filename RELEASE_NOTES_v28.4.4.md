# SpecsDekh v28.4.4 — Rankings Build Reliability Fix

- `/rankings` is now request-time rendered with `force-dynamic`.
- Temporary MongoDB Atlas/TLS failures can no longer abort `next build`.
- Each ranking category loads independently with `Promise.allSettled`.
- A failed category falls back to the existing empty state while other categories continue loading.
- No database data, ranking formulas, or public URLs were changed.
