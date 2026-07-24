# PhoneDock v18.1 Admin Bulk Automation

- Added Auto match all for the complete missing-specs queue.
- Missing phone IDs are loaded from a protected no-cache endpoint.
- Matching runs in safe batches of 100 with visible progress.
- Selected matching is no longer silently truncated to 100 records; all selected records are processed.
- Page-level selection remains available for manual review.
- The browser must remain open while bulk matching runs. Ambiguous matches are not applied automatically.
