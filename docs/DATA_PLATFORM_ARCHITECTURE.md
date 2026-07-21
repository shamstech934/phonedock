# PhoneDock Data Platform v2.0 architecture

The implementation reuses the existing pipeline: `CollectorSource` configuration selects a typed provider; `job-runner` fetches pages and checkpoints progress; mapping produces `NormalizedPhone`; validation, duplicate and conflict services create `CollectedPhone` review drafts; administrator approval calls the existing import/update path into `Phone`, `PhoneSpecs`, images and benchmarks. The existing data-quality scanner and price tracker remain separate downstream systems.

Working providers are JSON URL, REST API, CSV URL, XML feed, RSS/Atom feed, structured manual URL and the existing admin upload/import flow. Manufacturer adapters deliberately fail closed until an approved adapter is deployed. Jobs prevent concurrent queued/running work for one source and support full/incremental modes and serverless checkpoints.

No record is auto-published. Invalid, duplicate and conflicting records stay in review. Missing values remain empty. Provenance, checksum, source reliability, validation warnings/errors, completeness, quality and confidence are stored on each draft.
