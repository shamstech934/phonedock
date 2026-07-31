# SpecsDekh Phase 2 — Branding QA & Production Polish

## Completed

- Fixed remaining visible legacy fallback branding in the public header and footer.
- Integrated the SpecsDekh logo into the footer instead of a generic smartphone icon.
- Added production-ready browser and PWA assets:
  - `public/favicon.ico`
  - `public/apple-touch-icon.png`
  - `public/icon-192.png`
  - `public/icon-512.png`
- Updated Next.js metadata icon declarations for SVG, ICO, shortcut, and Apple touch icons.
- Updated the PWA manifest with 192×192, 512×512, and maskable icons.
- Renamed public repair/download filenames from `phonedock-*` to `specsdekh-*`.
- Renamed the public sample data file and its download response to `specsdekh-sample-data.json`.
- Updated affiliate UTM branding to `utm_source=specsdekh`.
- Updated public API health and recommendation-provider labels to SpecsDekh.
- Re-ran static branding checks. Remaining `PhoneDock` references are limited to the deliberate backward-compatible database settings migration.

## Compatibility preserved

- Existing cookie, event, CSS animation, JWT issuer/audience, Cloudinary preset, MongoDB defaults, and other compatibility-sensitive internal keys were not renamed.

## Verification

- Static source checks passed for old public domain references and visible legacy fallbacks.
- Full dependency installation/build could not run because the environment npm mirror returns 404 for `zod-validation-error-4.0.2.tgz`. No project-code build failure was confirmed.
