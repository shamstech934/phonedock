# PhoneDock v9.0 PC4 — Reviewed Repair Import

- Repair work-pack exports now contain editable columns for specs, images, or prices.
- Admin can upload a reviewed CSV back into the matching Data Quality queue.
- Dry-run preview validates every row before database writes.
- Apply is blocked while preview contains failed rows.
- Server validates Phone IDs, price ranges, and http(s) URLs.
- Specs are upserted into PhoneSpecs; numeric filter fields are derived where possible.
- Imported repairs are marked `user-submitted`, never silently marked verified.
- Maximum batch size is 500 rows to keep serverless executions bounded.
