# Administrator Guide

## Access and roles

Use an individually assigned administrator account. Do not share credentials. Permissions are enforced server-side; a hidden UI control is not an authorization boundary. Revoke sessions after credential compromise or role changes.

## First setup

The bootstrap endpoint is for an empty installation only. Configure a strong `FIRST_ADMIN_SETUP_KEY`, create the first administrator, verify login and then remove/rotate the setup key. Confirm the setup lock prevents a second bootstrap.

## Routine operations

- Review imports before publishing and inspect rejected rows.
- Monitor collector jobs, source health and data provenance.
- Review price-tracker runs and stale-price alerts.
- Schedule sponsors with explicit dates and priorities.
- Keep affiliate destinations on the approved host allowlist.
- Review security/audit events for failed authentication and privileged changes.

## Incident actions

Disable the affected source or job, preserve request/job IDs and logs, revoke exposed sessions or secrets, and follow `SECURITY.md` and `DEPLOYMENT.md`. Never repair production by directly changing undocumented database fields.
