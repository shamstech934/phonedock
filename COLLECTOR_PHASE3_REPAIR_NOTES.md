# Collector Phase 3 Repair

This release adds a deterministic repair path for legacy collector source headers.

- Source headers are sanitized to primitive text values before every collector run.
- Header-related source errors are cleared automatically.
- Admin → Collector Sources includes **Repair Sources**.
- The repair action sanitizes all source records and marks old failed jobs as ready to retry.
- No AI, guessed phone data, or invented retailer URLs are used.

After deployment:
1. Open Admin → Collector Sources.
2. Click **Repair Sources** once.
3. Open Collector Jobs and retry the failed Samsung job.
4. A source with no structured phone data should return a clean warning instead of a header crash.
