# PhoneDock Architecture

PhoneDock v1.0 is a Next.js App Router application backed by MongoDB through Mongoose. Public pages favor server rendering; interactive account, comparison, wishlist and admin surfaces use bounded client components.

## Runtime boundaries

- `src/app`: pages, layouts, metadata, route handlers and the catch-all API dispatcher.
- `src/components`: shared UI, phone cards, admin UI and feature-specific interaction layers.
- `src/lib`: authentication, database access, validation, observability, caching and domain services.
- `src/lib/models`: Mongoose schemas and indexes. Models must be imported through `models/index.ts` where practical.
- `scripts`: migrations, data preparation, environment validation and regression tests.
- `e2e`: Playwright browser and accessibility coverage.

## Request flow

Public pages call server-side fetch services, which connect through the shared MongoDB helper. API requests use dedicated account routes or the catch-all dispatcher. Admin handlers perform authentication and RBAC checks before data mutation. External URLs pass through allowlist/SSRF guards. Structured logs include request or job identifiers where available.

## Data domains

Core phones and brands are separated from users, user features, imports, collectors, price tracking, quality/provenance, media and commercial records. Cross-document workflows that require atomicity should use MongoDB transactions and therefore require a replica set in production.

## Design constraints

- Never import server-only secrets into client components.
- Keep page metadata and canonical generation server-side.
- Use the shared phone-card system for phone listings.
- Validate all boundary input and enforce pagination limits.
- Preserve indexes when evolving schemas; use an explicit migration for destructive changes.
- Background work must be idempotent and observable.

## Deployment topology

The supported topology is a Node 22 application runtime, MongoDB replica set/Atlas, SMTP provider, optional Cloudinary, Turnstile and analytics providers, plus an external scheduler calling authenticated cron endpoints. Horizontal application scaling is safe when rate limiting and job locks use shared persistence rather than process memory.
