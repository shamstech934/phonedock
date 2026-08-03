# Phone Listing Production Fix

## Completed
- Debounced phone search with URL synchronization and clear action.
- User-selectable 12, 20, or 32 phones per page, respected by server rendering and API hydration.
- Invalid/out-of-range pagination automatically returns to the last valid page.
- Image fallback state now resets when a card receives a new image URL.
- Missing-image placeholders are accessible and keep card dimensions stable.
- Truncated RAM, storage, display, chipset, and battery values expose full text through native tooltips.
- Existing advanced filters, sorting, price categories, pagination, compare, wishlist, and quick-view behavior retained.

## Production validation
Run `npm run typecheck`, `npm run lint`, and `npm run build` in CI/Vercel after installing dependencies.
