# Specs Intelligence Timeout Fix — v31.12.21

## Root cause
The previous scan used an N+1 query/write pattern for up to 200 phones in one Vercel invocation:
- one PhoneSpecs query per phone
- one or two DeviceSpecDataset queries per phone
- up to seven signal writes per phone

That could exceed the serverless function execution limit.

## Fix
- Durable SpecsIntelligenceScanJob model with cursor, progress, status, lease and errors.
- Maximum 25 phones per default batch; hard maximum 50.
- Cursor pagination by `_id`, no `skip` and no full collection load.
- PhoneSpecs, Brand and DeviceSpecDataset data fetched in bounded bulk queries.
- Signals written with unordered `bulkWrite` and existing unique identity `(phoneId, field)`.
- One batch per HTTP invocation; admin UI continues batches using separate requests.
- Distributed lease prevents two requests from processing the same job simultaneously.
- Failed scans show their error instead of incorrectly showing only “No signals found”.
- Progress, processed/total and cancel/retry controls added to the admin page.

## Preserved behavior
- Same seven monitored spec fields.
- Same critical/warning classification.
- Same local verified dataset recommendation source.
- Same admin approval workflow; no recommendation is auto-applied.
