# Collector Phase 2 — Production Completion

Implemented deterministic, non-AI collector hardening:

- Source create/list/test/toggle/edit/delete API paths use database connections and structured JSON errors.
- Endpoint host is automatically stored as an allowed domain when the admin does not provide one.
- Source tests make one bounded fetch and persist test status/message/time.
- HTTP redirects are followed safely (maximum three), with SSRF validation on every destination.
- HTML/manual sources request HTML explicitly and enforce response-size limits.
- Collector jobs resume from the next page instead of restarting from page 1.
- Serverless page limits count pages per invocation, fixing the permanent-pause bug.
- Cron resumes queued/paused jobs before creating new scheduled jobs.
- Collected records are refreshed per source+provider record instead of creating duplicate review rows on every run.
- Per-product source URLs are preserved for provenance.
- Active jobs cannot be deleted; sources with active jobs cannot be deleted.
- No AI, guessed phone data, or automatic public publishing was introduced.

Runtime requirement: each source must allow automated access and expose structured JSON/CSV/XML/RSS or usable Product/ItemList JSON-LD. Websites that block bots or expose only client-rendered HTML will return a clear test failure and require an approved feed/adapter.
