# PhoneDock v9.0 PC7 — Persistent AI Research Drafts

- Real Tavily + OpenAI research output is now stored in MongoDB.
- Added `AIResearchDraft` with sources, confidence, conflicts, specs, images and Pakistan price evidence.
- New drafts are `pending_review`; nothing is auto-published.
- Previous pending draft for the same phone/type is retired before a newer research draft is stored.
- Added authenticated `GET /api/admin/data-quality/ai-drafts` review-queue endpoint.
- Existing CSV workflow remains available as a backup/export path.

Required Vercel variables:
- `OPENAI_API_KEY`
- `TAVILY_API_KEY`
- Optional: `OPENAI_MODEL`, `TAVILY_SEARCH_DEPTH`, `AI_IMAGE_SEARCH_URL`, `AI_IMAGE_SEARCH_KEY`
