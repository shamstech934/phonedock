# Sprint 4 — Checkpoint 4 — Batch 3

## Advanced security and production monitoring

- Added privacy-preserving security event telemetry for admin login success, failure, lockout, disabled-account attempts, and malformed credentials.
- Security telemetry stores only short SHA-256 fingerprints for IP/User-Agent values; raw passwords, tokens, email addresses, and full IP addresses are never written to activity details.
- Added per-request correlation IDs on admin UI/API traffic for safer debugging across Vercel logs and API responses.
- Forced `no-store` caching semantics on admin pages and admin API responses handled by middleware.
- Hardened browser response policy with `Cross-Origin-Opener-Policy`, `Origin-Agent-Cluster`, `X-Permitted-Cross-Domain-Policies`, and disabled DNS prefetching.
- Replaced the obsolete reflective-XSS header behavior with the modern safe `X-XSS-Protection: 0` setting; CSP remains the primary XSS control.

## Deployment

- No database migration required.
- No new environment variables required.
- Existing admin sessions remain valid.
