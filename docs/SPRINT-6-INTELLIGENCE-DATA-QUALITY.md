# Sprint 6 — Intelligence and Data Quality

## Included

- Comparison advisor no longer treats missing scores as zero.
- Weighted recommendations now include a data-confidence signal.
- Near ties do not create a misleading category winner.
- Recommendations become provisional when too little data is available.
- Import duplicate detection now normalizes punctuation, spacing, Unicode and common noise words.
- Exact slug matches and conservative token-similarity matching are supported.
- Duplicate lookup is indexed by both normalized identity and slug.

## Deployment

Copy the patch folders into the repository root and allow overwrite. No database migration, dependency or environment variable is required.
