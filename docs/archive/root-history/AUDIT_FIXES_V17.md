# PhoneDock v17 Audit Fixes

- Removed legacy OpenAI, OpenRouter, Tavily enrichment code and AI research models/tests/docs.
- Re-enabled TypeScript enforcement during production builds.
- Added Node type definitions and aligned the application version to 17.0.0.
- Health endpoint now reports the same application version as package.json.
- Hardened local specification auto-match with brand, model-family and variant compatibility checks.
- Reduced repository root clutter and removed generated runtime logs.
- Added scheduled price update cron configuration.
