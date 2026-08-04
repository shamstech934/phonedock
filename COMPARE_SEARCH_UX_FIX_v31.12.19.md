# SpecsDekh v31.12.19 — Compare & Search UX Fix

## Compare page
- Two inline phone-search boxes are visible immediately on first load.
- Additional search slot appears automatically after each selected phone, up to the configured compare limit.
- Selected phones and their search controls stay together in one responsive grid.
- Specifications and category navigation now appear before scores, category winners, and the verdict.
- Score bars and winner cards use a more compact layout to reduce vertical space.
- Empty-state modal dependency is removed from the normal user flow.
- Compare hero height is reduced.

## Homepage search
- Autocomplete debounce reduced from 320ms to 160ms.
- Existing results remain visible while fresh results load.
- First search displays lightweight skeleton rows instead of a large blank loading panel.
- Request cancellation and client caching remain enabled.

## Validation
- TypeScript/TSX transpile syntax check passed for both modified files.
