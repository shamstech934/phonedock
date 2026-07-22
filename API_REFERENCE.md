# API Reference

All API responses are JSON unless the endpoint redirects or downloads a file. Validation failures use 4xx responses; internal details are not returned to clients. Rate-limited endpoints may return `429`. Request IDs should be retained when reporting failures.

## Account

- `POST /api/account/signup` — create a consumer account.
- `POST /api/account/login` — authenticate and establish a session.
- `POST /api/account/logout` — revoke/clear the current session.
- `GET /api/account/me` — current account summary.
- `PATCH /api/account/profile` — update validated profile fields.
- `/api/account/features` — authenticated wishlist/compare/user-feature operations.

## Public and commercial

- `GET /api/affiliate` — validated, allowlisted affiliate redirect with aggregate click tracking.
- `POST /api/buying-assistant` — buying-assistant request with bounded input.
- `POST /api/observability/web-vitals` — validated client performance telemetry.
- `POST /api/newsletter` — begin double-opt-in subscription.
- `GET /api/newsletter/confirm?token=...` — confirm subscription.
- `GET /api/newsletter/unsubscribe?token=...` — unsubscribe.

## Catch-all domains

`/api/[[...path]]` dispatches public content, admin authentication/CRUD, first setup, imports, downloads, collectors, data-quality, price-tracker and cron operations. These are not interchangeable public APIs: admin and job endpoints require their documented role or secret. Consult handler files under `src/app/api/[[...path]]/handlers` for the exact method, permission and schema before integration.

## Compatibility

Version 1.0 does not promise a stable third-party API. Mobile/public API versioning, keys, quotas and deprecation headers must be designed before external clients are onboarded.
