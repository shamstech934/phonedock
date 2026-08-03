# SpecsDekh v31.10 — Manage Phones Production Phase

## Fixed
- Clickable Total, Published, Draft / Review, Upcoming, Trending, Featured and PTA Approved metric cards.
- Draft / Review card and filter include both `draft` and `pending` records.
- Separate Draft-only and Pending-only filters remain available.
- Unknown PTA filter is implemented in the backend.
- Phone list API responses use safe JSON parsing and expose actionable HTTP errors.
- Delete failures remain on the page and show the real error instead of silently failing.
- Full filtered phone inventory can be exported as CSV across all result pages.
- Phone JSON now includes `status`, `brandName`, `model`, `active`, `deletedAt`, views and timestamps.
- Shared Phone type matches the API compatibility fields.

## Preserved
- Search, sorting, pagination, brand filters and PTA filters.
- Single view/edit/delete actions.
- Bulk publish, draft, feature, trend and delete actions.
- Old bulk-import cleanup workflow.

## Validation
- Focused TypeScript syntax transpilation passed for the modified TS/TSX files.
- Full dependency-aware build must be verified by GitHub Actions/Vercel.
