# Production environment

## Required

- `MONGODB_URI`: valid MongoDB URI accepted by `src/lib/mongodb-env.ts`.
- `JWT_SECRET`: at least 32 characters and not placeholder-like.
- `CRON_SECRET`: at least 32 characters and not placeholder-like.
- `NEXT_PUBLIC_BASE_URL`: absolute HTTPS origin. This is the only public site URL variable used by PhoneDock.
- `FIRST_ADMIN_SETUP_KEY`: temporary bootstrap key. Remove it and redeploy immediately after creating the first superadmin.

## Optional all-or-nothing groups

Configure every variable in a group or leave the whole group blank:

- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Turnstile: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- Cloudinary: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Variables to remove

- `NEXT_PUBLIC_SITE_URL`: unused. Use `NEXT_PUBLIC_BASE_URL`.
- `COLLECTOR_SECRET`: unused. Collector routes already require an authenticated admin and `collectors:read` or `collectors:manage` permission.

Run `npm run env:check` before deployment. The validator reports exact errors and warns about temporary or obsolete variables.
