# SpecsDekh Phase 8 — Release Readiness Center

Added a safe, read-only production release gate.

## Included
- Admin Release Readiness page
- Required environment-presence checks without exposing values
- SpecsDekh production URL validation
- Published/draft catalog counts
- Critical/open Data Quality issue checks
- Missing specs, images and PKR prices checks
- Continuous Monitoring freshness check
- Google meta verification treated as optional when DNS verification is used
- Weighted readiness score and controlled-release verdict

## Routes
- UI: `/admin/release-readiness`
- API: `GET /api/admin/release-readiness`

No records are modified by these checks.
