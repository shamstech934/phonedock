# PhoneDock v11.3 AI Research Control Fix

- Refresh All now reloads provider status, jobs and drafts with no-cache requests.
- Visible loading state and last refresh timestamp.
- Active jobs are shown by default; old completed/cancelled jobs are hidden.
- Optional job-history view.
- Safe cleanup endpoint removes only completed, completed-with-errors and cancelled job records.
- Pending drafts and active jobs are never deleted by cleanup.
- Historical cancelled jobs can no longer be retried accidentally.
- Completed-with-errors jobs no longer expose a misleading Run button.
