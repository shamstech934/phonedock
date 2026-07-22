# Data Platform Operations

Phone data enters through controlled imports and collectors, is normalized and validated, and carries source/provenance information before publication. Price tracking is a separate operational workflow.

## Principles

- Preserve raw source references and ingestion timestamps.
- Normalize units and identifiers deterministically.
- Do not fabricate missing specifications, ratings or prices.
- Prevent duplicate phones and duplicate job processing.
- Make jobs idempotent, resumable and traceable with job IDs.
- Review quality failures before publication.

## Operations

Collectors must obey source authorization, rate limits and SSRF protections. Imports use staging/preview and durable batch records. Price jobs record failures without replacing valid data with empty values. Archive verbose job history under a documented retention policy while retaining aggregates and audit evidence.

Schema/index changes require staging measurement and a migration. Large imports should be tested with production-like volume and rollback instructions.
