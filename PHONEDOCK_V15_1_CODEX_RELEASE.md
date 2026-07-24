# PhoneDock v15.1 — Local Specs Batch Automation

## Completed

- Added **Auto match selected** inside Admin → Data Quality → Missing Specs.
- Processes up to 100 selected phones per safe batch.
- Uses only the local MongoDB specifications dataset.
- Automatically writes only high-confidence matches (default 92%+).
- Requires a clear score margin over the second candidate to prevent wrong variants.
- Requires at least three populated specification fields before auto-apply.
- Ambiguous matches are returned as **Needs review** and are not written.
- Not-found and failed records are reported separately.
- Batch activity is recorded in Activity Log.
- Existing one-by-one Find specs and manual preview/apply workflow remains available.

## Usage

1. Import a specifications dataset CSV.
2. Select phones in Missing Specs.
3. Click **Auto match selected**.
4. High-confidence matches are applied; uncertain records remain for manual review.

No AI, paid credits, or runtime external API is used.
