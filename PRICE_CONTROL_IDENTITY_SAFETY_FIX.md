# Price Control identity safety fix

This pass fixes a false-positive catalog link where a numeric phone model such as `14` could be matched to a generic `14-inch laptop` product page.

Changes:
- Catalog auto-link now requires brand/model identity instead of numeric overlap alone.
- Obvious laptop/notebook/monitor/desktop/television URLs are rejected from phone auto-linking.
- Retail product-page validation rejects obvious non-phone product titles.
- Existing verified listings whose stored title is clearly a non-phone product are demoted to review during the next price sync.
- Runtime price validation now populates the phone brand so numeric model names can be verified safely.
- Price Control list shows brand + model for ambiguous numeric model names.
- Missing/zero public prices show `Price unavailable` instead of `PKR 0`.
- Price Control modal now prefills from the phone's actual existing manual/automatic price identity when available instead of relying on generic defaults.
