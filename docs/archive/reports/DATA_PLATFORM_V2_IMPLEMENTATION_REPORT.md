# PhoneDock Data Platform v2.0 implementation report

## Existing architecture reused

The repository already had `CollectorSource`, `CollectorJob`, `CollectedPhone`, typed JSON/API/CSV/manual/manufacturer providers, a checkpointed job runner, normalization, validation, duplicate/conflict detection, field provenance, review drafts, approval/import, activity logs, admin source/job pages, data-quality scanning, import v2 and price tracking. This sprint extends that chain; it does not create a second collector.

## Implemented

- Added XML and RSS/Atom structured-feed providers with DTD/entity rejection.
- Added a shared nested-path mapper with defaults, cleanup, slugging, numeric and boolean parsing.
- Applied SSRF/private-network/domain checks, redirect blocking, timeout and response-size limits to provider requests.
- Expanded source schema for domain allowlists, limits, schedules, defaults and successful-sync state.
- Fixed source UI/API provider-name and endpoint mismatches; added connection test/preview, incremental run and downloadable templates.
- Fixed invalid collector job statuses/modes, pending-review dashboard count and missing source deletion route.
- Prevented concurrent active jobs for one source and attached request IDs/retry fields.
- Reused `approveAndImport` for safe reviewed create/update instead of a duplicate publish path; invalid records cannot be approved.
- Added checksums, last verification, validation errors/warnings, completeness, quality and confidence scores.
- Custom authorization/API-key/cookie headers are not persisted; secrets are referenced by environment-variable name.

## Model changes

`CollectorSource`: XML/RSS types, allowed domains, timeout, response limit, defaults, schedule and last successful sync. `CollectorJob`: full/incremental modes, retry count, request ID and active-source index. `CollectedPhone`: checksum, verification timestamp, split warnings/errors and three quality scores. Mongoose adds these fields/indexes on deployment; production should run the normal migration/index review before traffic.

## Verification

- `npm ci`: passed; Node 24 engine warning because the project declares Node 22.
- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 181 existing warnings.
- `npm test`: passed, including Data Platform mapping/XML/scoring/manufacturer fail-closed tests.
- `npm run build`: passed; all 69 static pages generated.
- Playwright discovery passed. Live collector E2E was not run because no staging MongoDB/admin credentials or approved remote feed were provided.

## Demo result and limitations

The local test fixture proves structured input → nested mapping → normalization → validation/scoring and XML/RSS safety, plus manufacturer fail-closed behavior. A database-backed add/test/collect/review/approve/publish/update demonstration remains a staging launch gate and was not falsely marked passed. Run it with a disposable staging database, a dedicated collector admin and one licensed local/uploaded fixture.

Manufacturer sources remain disabled until vendor approval and an explicit adapter are supplied. File uploads continue to use the existing Import v2 upload pipeline rather than duplicating it inside providers. Price templates and policy are supplied, while collection-to-PriceTracker persistence still requires a reviewed store/source adapter. Image URL validation is present at record validation and remote fetch protection exists, but licensed Cloudinary download/variant generation remains an integration-specific staging task.
