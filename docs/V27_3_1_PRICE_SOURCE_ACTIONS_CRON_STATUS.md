# SpecsDekh v27.3.1 — Price Source Actions & Cron Status

- Price source actions now use visible **Edit** and **Delete** labels instead of icon-only controls.
- Existing edit and permanent-delete modals remain connected to authenticated CRUD APIs.
- Price Tracker settings now report whether `CRON_SECRET` is configured without exposing its value.
- Cron card shows a green ready state after redeployment when the secret exists.
- Added an admin-only **Run now** button that calls the protected server-side price-sync route; the browser never receives the cron secret.
- Optional `PRICE_SYNC_CRON` can override the displayed schedule; default is `0 1 * * *` (06:00 PKT).
