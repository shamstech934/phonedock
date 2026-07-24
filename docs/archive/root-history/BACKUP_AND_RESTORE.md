# MongoDB Backup and Restore

The detailed command runbook is in `docs/MONGODB_BACKUP_RESTORE_RUNBOOK.md`. This file defines the release policy.

- Use encrypted, access-controlled backups in a different failure domain.
- Take a backup before every migration and high-risk import.
- Never restore production into development without approved anonymization.
- Test a restore into an isolated database on a schedule.
- Verify collection counts, indexes, representative phone/account records and application smoke tests.
- Record recovery point objective, recovery time objective, backup age, checksum and operator.

## Disaster recovery checklist

Freeze writes and jobs; identify the incident window; preserve the damaged state; select a verified recovery point; restore to an isolated target; validate data and indexes; switch application configuration through the approved process; rotate exposed secrets; monitor; and publish an incident record. A backup that has not been restored and verified is not considered usable.
