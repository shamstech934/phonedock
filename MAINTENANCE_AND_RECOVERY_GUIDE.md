# Maintenance and Recovery Guide

## Daily

- Review failed jobs, stale prices, source health, and pending reviews.
- Check deployment and cron logs.

## Weekly

- Run Data Quality full scan.
- Review missing images/specs/prices and duplicate candidates.
- Export critical data and verify backup completion.

## Before bulk imports

- Create a database backup.
- Use preview/dry-run.
- Apply bounded batches.
- Review import history and reconciliation output.

## Recovery order

1. Disable the failing source/job.
2. Preserve logs and failed payload identifiers.
3. Restore the previous deployment when necessary.
4. Reconcile incomplete imports/jobs.
5. Re-enable in a bounded test batch.

## Security maintenance

- Rotate secrets after suspected exposure.
- Never commit `.env` files.
- Keep admin accounts minimal and review activity logs.
