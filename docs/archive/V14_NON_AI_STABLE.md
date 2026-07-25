# PhoneDock v14.0 — Stable Non-AI Release

This release removes the paid AI research experiment from the production codebase.

Removed:
- AI Research tab and controls
- OpenAI/OpenRouter/Tavily provider code
- AI jobs and AI draft API routes
- AIResearchJob and AIResearchDraft models
- AI provider environment variables and related tests/docs

Kept:
- Data Quality overview and scans
- Missing specs, images and prices queues
- CSV export/import and reviewed repair workflow
- Duplicate, orphan and stale-price tools
- Core admin and public website functionality

Recommended next workflow:
1. Export missing-data CSV work packs.
2. Complete the CSV using trusted data.
3. Preview and import repairs from the Data Quality Center.
