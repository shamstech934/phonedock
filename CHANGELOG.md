# Changelog

## 1.0.0-rc.1 — 2026-07-22

### Added

- Phone database, comparison, rankings, search and editorial surfaces.
- Account wishlist, compare history, recently viewed and price-alert foundations.
- Admin, import, collector, price tracking, quality and provenance workflows.
- Commercial affiliate, sponsor, consent-gated analytics/advertising and double-opt-in newsletter foundations.
- Canonical enterprise operations, security, architecture and API documentation.

### Security

- Rate-limited account flows, session revocation/versioning and security events.
- Shared validation, SSRF controls, affiliate allowlists and environment validation.
- Hashed newsletter verification tokens and consent-gated third-party scripts.

### Changed

- Standardized phone-card layout and rating presentation.
- Set release metadata to semantic version `1.0.0`.

### Known limitations

- Release build requires a valid staging/production `MONGODB_URI` during prerender.
- Commercial reporting/admin workflows are foundations and are not feature-complete.
- Lighthouse targets and full staging browser coverage require a deployed production-like environment.
- External mobile API compatibility is not guaranteed in 1.0.

No intentional breaking API change is declared; integrations with internal catch-all handlers remain unsupported.
