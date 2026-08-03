# Compare Module Production Fix

- Removed duplicate RAM specification row.
- Removed duplicate URL update in the picker confirmation action.
- Added keyboard navigation for search results (Up, Down, Enter, Escape).
- Added active-result accessibility metadata and visual focus.
- Added Share, Copy Link, and Print actions for completed comparisons.
- Persisted the Only Show Differences preference locally.
- Made the comparison table phone header sticky while scrolling.
- Replaced misleading first-value-as-winner highlighting in text specs with neutral difference highlighting.
- Hardened empty-price handling so no Infinity/invalid best-price state is produced.
- Preserved URL-based comparison hydration, duplicate selection protection, max-phone validation, mobile horizontal table scrolling, score winners, confidence notices, and null-safe values.
