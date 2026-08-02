# Collector retry and legacy error fix

- Old raw Headers.append/Mongoose errors are sanitized in the jobs API.
- Failed jobs use Retry only; Resume is limited to paused jobs.
- Retry sanitizes and persists source headers before starting the job.
- Retry clears old counters, errors, and completedAt.
- Collector Jobs uses the shared safe API response reader.
