# PhoneDock v5 Final Release

## Public and admin access

- The public header no longer exposes an Admin link.
- `/admin` and every `/admin/*` page remain protected by the secure admin session cookie.
- Admin pages are excluded from robots and carry `noindex, nofollow` metadata.
- Knowing the `/admin/login` URL does not provide dashboard access without valid credentials.

## Client accounts

Public users now have:

- `/signup`
- `/login`
- `/account`
- Secure HTTP-only account session cookies
- Account links to wishlist, recently viewed, and compare

Add `USER_JWT_SECRET` in Vercel. It may be the same strong 32+ character value as `JWT_SECRET`, although a separate secret is recommended.

## Launch Center

Items marked “Not configured” are external service account IDs, not missing code. Add the relevant Vercel environment variables only after creating the matching Google, Microsoft, Cloudinary, email, or affiliate account.
