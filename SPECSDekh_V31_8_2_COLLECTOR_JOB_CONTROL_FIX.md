# SpecsDekh v31.8.2 — Collector Job Control Fix

## Fixed

- Paused collector jobs can now be deleted directly. Only queued/running jobs require cancellation first.
- Delete API errors no longer replace the complete Collector Jobs screen.
- Delete modal shows the backend error inline and keeps the job list usable.
- Delete action has a loading/disabled state to prevent duplicate requests.
- Paused serverless batches automatically resume while the Collector Jobs page remains open.
- The runner default now processes 3 pages per invocation, matching the admin settings/API default.
- Scheduled collector cron remains the fallback continuation mechanism when the admin page is closed.

## Safety

- Running and queued jobs still cannot be deleted without cancellation.
- Deleting a job does not automatically delete collected review records.
