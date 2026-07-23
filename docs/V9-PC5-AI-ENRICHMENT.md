# PhoneDock v9 PC5 — AI Enrichment Drafts

PC5 adds review-only AI work packs for missing specs, images, and prices.

1. Select 1–10 phones in a Data Quality live queue.
2. Click **AI draft work pack**.
3. Review the downloaded CSV. AI confidence and source notes are included.
4. Remove incorrect or uncertain values.
5. Upload through **Import reviewed repair CSV**, Preview, then Apply.

No AI suggestion is written directly to production. Image candidates must be checked for product match and usage rights. Pakistan prices should only be accepted when a current source URL is present.

Required Vercel variables for specs/prices:
- `AI_ENRICHMENT_API_URL`
- `AI_ENRICHMENT_API_KEY`
- `AI_ENRICHMENT_MODEL`

Optional image provider:
- `AI_IMAGE_SEARCH_URL`
- `AI_IMAGE_SEARCH_KEY`
