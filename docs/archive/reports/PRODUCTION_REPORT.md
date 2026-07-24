# PhoneDock production finalization report

## Implemented

- Environment validation now warns when obsolete `NEXT_PUBLIC_SITE_URL` is configured.
- Environment validation now warns when unused `COLLECTOR_SECRET` is configured.
- Collector security was reviewed: all collector API handlers require authenticated admin access and explicit `collectors:read` or `collectors:manage` permissions, so a separate collector secret is unnecessary.
- `.env.example` now identifies `NEXT_PUBLIC_BASE_URL` as the canonical HTTPS origin and explicitly rejects the old variable name.
- Optional email, Turnstile and Cloudinary groups remain all-or-nothing in `src/lib/env-validation.ts`.
- Obsolete AI enrichment runtime and two direct legacy tests were removed.
- Historical root markdown files were moved to `docs/archive/root-history/`; no historical documentation was destroyed.

## External checks still required

The repository cannot read the user's private Vercel environment values. Verify the Vercel dashboard contains correctly formatted required variables and no partial optional groups. Remove `FIRST_ADMIN_SETUP_KEY` after initial admin creation.

Playwright browser installation and tests require a complete dependency installation. Run the commands in `DEPLOYMENT.md` or the uploaded task prompt on a machine/CI runner with network access.
