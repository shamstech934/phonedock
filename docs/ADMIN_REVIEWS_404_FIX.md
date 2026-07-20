# Admin Reviews 404 Fix

## Root cause
The Review Moderation UI called `GET /api/admin/reviews` and `GET /api/admin/reviews/stats`, but those GET handlers had accidentally been placed inside the DELETE handler. The review status update handler was also in the wrong HTTP handler, so moderation updates could return 404.

## Fixes
- Added review list handling to the admin GET router.
- Added review statistics handling to the admin GET router.
- Added review moderation updates to the admin PUT router.
- Added ObjectId validation and proper 400/404 responses.
- Added functional Spam filtering via `spamFlags`.
- Mapped the Spam action to a flagged review with a `manual-spam` marker, matching the database schema.
- Preserved reviewer email privacy in list responses.
- Kept pagination valid for empty results (`totalPages: 1`).

## Verification
- `npm ci` passed.
- `npx tsc --noEmit` passed.
- ESLint reported zero errors in the changed files; existing warnings remain.
