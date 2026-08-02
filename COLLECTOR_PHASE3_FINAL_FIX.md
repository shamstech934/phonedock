# Collector + Price Tracker Phase 3 Final Runtime Fix

- Manual/HTML/RSS/JSON/CSV sources now ignore legacy custom headers completely.
- Only API sources may send configured custom headers.
- HTTP requests use a plain string header record instead of a `Headers` object.
- Retry clears stale source/job errors and re-runs with the safe request builder.
- No AI, guessed product URLs, or guessed prices are used.
