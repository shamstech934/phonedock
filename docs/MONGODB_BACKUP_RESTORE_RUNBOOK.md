# MongoDB backup and restore runbook

This runbook requires MongoDB Database Tools. Keep production, staging, and development credentials and buckets completely separate. Do not place database URIs or archives in Git.

## Backup

1. Create an encrypted, access-controlled destination and record the environment, UTC time, application release, cluster, and operator.
2. Prefer an Atlas snapshot/PITR for production. Also make a logical backup before high-risk migrations:

```bash
mongodump --uri="$SOURCE_MONGODB_URI" --archive="phonedock-YYYYMMDD-HHMM.archive" --gzip
```

3. Confirm a zero exit code, non-zero archive size, encryption at rest, retention policy, and checksum (`sha256sum` or `Get-FileHash`). Never log the URI.
4. Test restores on a disposable isolated cluster regularly; an untested backup is not a recovery plan.

## Restore and verification

Pause writers, collectors, cron jobs, imports, and deployments. Confirm the target URI twice. Restore into a new database/cluster first:

```bash
mongorestore --uri="$TARGET_MONGODB_URI" --archive="phonedock-YYYYMMDD-HHMM.archive" --gzip --nsFrom="phonedock.*" --nsTo="phonedock_restore.*"
```

Do not use `--drop` against production unless incident command has explicitly approved destructive replacement and a fresh rollback snapshot exists. Verify collection/document counts, indexes, sampled phones/prices/users, admin login, public search, compare, imports, alerts, and application logs. Re-run migrations only when their documented version requires it.

## Cutover and rollback

Keep the original cluster read-only during validation. Cut over by changing the secret-managed URI, deploy one release, run smoke tests, then resume writers gradually. Roll back by restoring the prior URI/deployment and replaying only reviewed writes made after the recovery point. Preserve evidence and timestamps.

## Disaster recovery checklist

- Declare owner, severity, recovery point objective, and recovery time objective.
- Revoke leaked credentials and preserve audit logs if compromise is suspected.
- Select the last known-good snapshot/PITR timestamp; record possible data loss.
- Restore to an isolated target and complete verification.
- Obtain two-person approval for production cutover or destructive restore.
- Monitor errors, auth, collectors, imports, alerts, and data counts after cutover.
- Notify stakeholders, document the timeline, rotate temporary credentials, and complete a post-incident review.
