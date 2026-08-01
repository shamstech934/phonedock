# SpecsDekh v27.2.2 — Public Brands Cleanup

## Fixed
- Public `/brands` directory now shows only brands that have at least one active, published phone.
- Empty imported brand placeholders remain available in Admin → Brands and appear publicly automatically after a phone is published.
- Brand directory cache key bumped so the corrected catalogue is refreshed after deployment.
- Brand cards now use the shared normalized `BrandLogo` renderer for consistent sizing, centering, and initials fallback.
- Apple SVG viewBox was tightened and centered so the mark sits correctly inside its card.
- Public brands are ordered by published phone count, then alphabetically.

## Safety
- No brand records were deleted.
- No phone records were changed.
- Admin brand management remains unchanged.
