# PhoneDock v8.0 RC6 — Smart Search Results Fix

## Fixed
- Smart natural-language queries now load matching phones automatically on the search page.
- Explicit price ranges take priority over conflicting upper-budget phrases.
- Roman Urdu phrases such as `80k ke andar` and `1 lakh se kam` are parsed correctly.
- Chipset/filter words are removed from residual text search so they no longer cause false zero-result pages.
- Smart filter URLs now use the public API's supported parameter names.
- `/phones` server rendering now supports direct price ranges, chipset, display type, refresh rate, camera, and battery filters.
- Performance, camera, battery, and value queries now sort by their proper score fields.

## Verification
- Modified TypeScript/TSX files passed TypeScript syntax transpilation checks.
- Smart parser runtime cases passed for budget, range, Roman Urdu, chipset, display, refresh-rate, and conflicting-budget queries.
