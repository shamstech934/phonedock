# SpecsDekh v27.3 — Price Source Manager

## Completed

- Added Edit action for every Price Tracker source.
- Added safe Delete action with linked-listing warning.
- Sources with linked listings require typing the source name before permanent deletion.
- Edit modal manages name, source type, HTTPS base URL, allowed domains, priority, status, trust state, and internal notes.
- Allowed domains are normalized automatically and derived from the base URL when omitted.
- Source creation now sends the selected source type correctly instead of silently defaulting to retailer.
- Backend validation now enforces supported source types, HTTPS URLs, unique domains, and priority range 0–100.
- Existing activity logs for create, update, pause/activate, trust, and delete remain intact.
- Source list and overview refresh after edits and deletes.

## Safety

Deleting a source permanently deletes its linked `PhoneRetailListing` records. The UI shows the exact linked listing count and requires typed confirmation when the count is greater than zero.

## Verification

- Production static audit: passed (92 routes, 0 broken links).
- Regression test command: passed.
- TypeScript syntax parse: passed for changed frontend and backend files; full dependency-aware build remains delegated to GitHub Release Gate/Vercel.
