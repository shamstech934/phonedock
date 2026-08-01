# SpecsDekh v27.2 — Brand Experience & Logo Audit

## Homepage
- Popular Brands now uses a stable six-column desktop grid.
- 11 brands plus the All Brands CTA fill two complete desktop rows.
- Brands with published phones are prioritised; active imported brands supplement empty slots.
- Logo containers use one neutral transparent treatment instead of inconsistent coloured squares.
- Legacy 13-brand / 7-column settings migrate automatically to 11 brands / 6 columns.

## Brand assets
- Added normalized local SVG marks for major mobile brands.
- Public brand cards and brand pages resolve known brands to local assets.
- Unknown brands continue to use the logo managed in Admin.
- Missing logos fall back to readable initials.

## Admin
- Added Brand Logo Audit information.
- Added Normalize Logos action for the visible page.
- Added per-brand status: normalized, custom, or missing.
- Added recommended-logo action in the create/edit modal.

## Validation
- Production static audit: PASS.
- Admin production audit: PASS with no endpoint findings.
