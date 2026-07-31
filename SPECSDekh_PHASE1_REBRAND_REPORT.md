# SpecsDekh Phase 1 Rebranding

## Completed

- Replaced user-facing `PhoneDock` branding with `SpecsDekh` across public and admin application code.
- Replaced legacy public domain fallbacks with `https://specsdekh.com`.
- Updated contact addresses to the `@specsdekh.com` domain.
- Updated metadata, canonical URLs, Open Graph, Twitter cards, JSON-LD organization/website data, sitemap/robots URL fallbacks, PWA manifest, emails, legal pages, login, header, footer, loading states, ads text, news authorship, share messages, and admin branding.
- Added a backward-compatible settings migration so existing MongoDB settings using the old default brand are migrated to SpecsDekh without changing database names, collections, auth issuers, cookie keys, or other compatibility-sensitive identifiers.
- Added new assets:
  - `public/logo.svg` — square SpecsDekh logo
  - `public/favicon.svg` — browser/PWA icon
  - `public/wordmark.svg` — full SpecsDekh wordmark
  - `public/og-image.png` — 1200×630 social sharing image
- Updated package display name to `specsdekh`.

## Intentionally preserved

The following internal identifiers remain unchanged to avoid breaking existing users, sessions, data, integrations, or migrations:

- MongoDB database/collection defaults that use `phonedock`
- JWT issuer/audience values
- Cookie/localStorage/event keys
- Cloudinary upload preset fallback
- CSS animation class names and internal IDs

## Verification

- Static search confirms no old user-facing `PhoneDock`, `phonedock.pk`, or `phonedock-pi.vercel.app` references remain, except the deliberate legacy migration checks in `Settings.ts`.
- A full dependency install/build could not run in this environment because the internal npm mirror returned 404 for `zod-validation-error-4.0.2.tgz`. This is a registry availability issue, not a confirmed project-code failure.
