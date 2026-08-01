# SpecsDekh v27.4.1 — Source Type + Mobile Responsive Hotfix

## Fixed
- Price Tracker source-type dropdown now normalizes values through the shared `PriceSourceType` helper instead of assigning a plain string.
- Resolves the Vercel TypeScript error: `Type 'string' is not assignable to type PriceSourceType`.
- Mobile phone grids are constrained to the viewport and no longer create horizontal overflow.
- Phone cards use a compact 350px mobile height instead of the desktop 440–472px height.
- Specs and secondary action buttons are hidden on small screens to prevent overlong cards.
- Very narrow screens below 360px switch to a single-column grid.
