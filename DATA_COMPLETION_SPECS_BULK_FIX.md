# Data Completion — Missing Specs Bulk Fix

This build starts the frozen post-Price-Tracker Data Completion work.

## Changed
- Local spec dataset now stores the complete PhoneSpecs text field set instead of only seven basic fields.
- Bulk Auto Match applies all available display, processor, camera, battery/body, connectivity and OS fields from a high-confidence local dataset match.
- Existing safety remains: ambiguous matches are review-only; no low-confidence auto-write.
- Numeric filter fields (RAM GB, storage GB, battery mAh, camera MP, screen inches) are still derived during apply.
- Data Quality UI now explains that a full PhoneDock specs CSV can be used for bulk completion.

## Important
`Auto match all` can only fill phones for which the imported local dataset contains an actual matching phone row. Category/listing-page titles are not specifications. If a phone is reported `not found`, import a real device-spec dataset row for that model; the system will not invent specifications.

## Verification note
The uploaded ZIP did not contain node_modules. Dependency installation in the execution environment was blocked by an internal npm mirror returning 404 for zod-validation-error, so a full local Next.js build could not be completed here. The source changes are isolated to the data-completion dataset/model/matcher/UI paths.
