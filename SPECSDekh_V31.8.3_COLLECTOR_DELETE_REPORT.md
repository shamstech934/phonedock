# SpecsDekh v31.8.3 — Collector Job Delete Fix

- Force-safe deletion for queued, running, paused, completed, partial, failed and cancelled jobs.
- Active jobs are cancelled before deletion instead of returning an unexplained HTTP 409.
- Collected review candidates are preserved; their deleted job reference is unset.
- Delete accepts JSON body or `jobId` query fallback.
- Activity log records the previous job status.
- Frontend sends explicit force-delete intent and keeps the jobs screen mounted on failures.
