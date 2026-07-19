# PhoneDock Data Quality Center — Deployment Guide

> **Version:** 1.0.0  
> **Deployment Type:** Zero-Downtime (database migrations first, then code deploy)  
> **Estimated Downtime:** 0 minutes  
> **Rollback Time:** < 5 minutes

---

## 1. Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 18.x | LTS |
| PostgreSQL | 15.x | For partial unique index support |
| Prisma Client | 5.x | Generated from schema |
| Next.js | 14.x+ | App router |
| Existing PhoneDock schema | Current | Migration appends, doesn't alter existing tables |

### Verify Prerequisites

```bash
node --version    # v18.x or v20.x
npx prisma --version  # 5.x
psql --version    # 15.x+
```

---

## 2. Deployment Steps

### Step 1: Database Migration

The Data Quality Center adds two new tables and does **not** modify any existing tables.

```bash
# Review the migration SQL before applying
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# Apply the migration
npx prisma migrate deploy
```

This creates:

1. `DataQualityIssue` table with all indexes
2. `ScanJob` table with all indexes

**No existing tables are altered.** This migration is safe to run during live traffic.

### Step 2: Generate Prisma Client

```bash
npx prisma generate
```

### Step 3: Verify Index Creation

After migration, confirm all indexes exist:

```sql
-- DataQualityIssue indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'DataQualityIssue'
ORDER BY indexname;
```

**Expected indexes:**

| Index Name | Type | Fields | Notes |
|-----------|------|--------|-------|
| `DataQualityIssue_pkey` | Primary | `id` | Auto-created |
| `DataQualityIssue_issueKey_status_key` | Unique (partial) | `issueKey, status` | `WHERE status IN ('OPEN','IGNORED','NEEDS_REVIEW')` |
| `DataQualityIssue_status_idx` | B-tree | `status` | Status filtering |
| `DataQualityIssue_severity_idx` | B-tree | `severity` | Severity filtering |
| `DataQualityIssue_issueType_idx` | B-tree | `issueType` | Type filtering |
| `DataQualityIssue_entityType_entityId_idx` | Composite B-tree | `entityType, entityId` | Entity lookup |
| `DataQualityIssue_importId_idx` | B-tree | `importId` | Import tracing |
| `DataQualityIssue_detectedAt_idx` | B-tree | `detectedAt` | Time-range queries |

```sql
-- ScanJob indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ScanJob'
ORDER BY indexname;
```

**Expected indexes:**

| Index Name | Type | Fields | Notes |
|-----------|------|--------|-------|
| `ScanJob_pkey` | Primary | `scanId` | Auto-created |
| `ScanJob_status_createdAt_idx` | Composite B-tree | `status, createdAt` | Find active/recent scans |
| `ScanJob_createdBy_createdAt_idx` | Composite B-tree | `createdBy, createdAt` | User's scan history |

### Step 4: Deploy Application Code

```bash
# Standard deployment process
git pull origin main
npm install --production
npm run build

# Restart the application (process manager specific)
pm2 reload phonedock
# or
systemctl restart phonedock
```

The new API routes and admin UI page will be available immediately after the restart.

### Step 5: Verify Deployment

Run these checks in order:

```bash
# 1. API is responsive
curl -s -o /dev/null -w "%{http_code}" \
  https://your-domain.com/api/admin/data-quality/summary \
  -H "Cookie: your-auth-cookie"

# Expected: 200

# 2. Summary returns valid JSON
curl -s https://your-domain.com/api/admin/data-quality/summary \
  -H "Cookie: your-auth-cookie" | jq '.healthScore'

# Expected: 100.0 (no issues yet on fresh install) or actual score

# 3. Admin UI loads
curl -s -o /dev/null -w "%{http_code}" \
  https://your-domain.com/admin/data-quality

# Expected: 200
```

---

## 3. Permission Setup

### 3.1 Register Permissions

Add the four data-quality permissions to the permissions system. This depends on how PhoneDock manages permissions (likely a `Permission` table).

```sql
-- Insert new permissions (adjust table/schema names to match your system)
INSERT INTO "Permission" ("id", "name", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'data-quality:read', 'View data quality issues, scans, and health scores', NOW(), NOW()),
  (gen_random_uuid(), 'data-quality:scan', 'Initiate data quality scans', NOW(), NOW()),
  (gen_random_uuid(), 'data-quality:fix', 'Resolve, ignore, or auto-fix data quality issues', NOW(), NOW()),
  (gen_random_uuid(), 'data-quality:delete', 'Delete data quality issues (reserved)', NOW(), NOW());
```

### 3.2 Assign Permissions to Roles

```sql
-- Get the permission IDs
SELECT id, name FROM "Permission" WHERE name LIKE 'data-quality:%';

-- Assign to roles (adjust role IDs/names to match your system)
-- Superadmin: all 4 permissions
-- Admin: all 4 permissions
-- Editor: read, scan, fix (3 permissions)
-- Reviewer: read only (1 permission)
```

If your system uses a role-permission mapping table:

```sql
-- Example: RolePermission junction table
-- Assuming role IDs are known, permission IDs retrieved above

-- Editor gets read, scan, fix (NOT delete)
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r, "Permission" p
WHERE r.name = 'editor'
  AND p.name IN ('data-quality:read', 'data-quality:scan', 'data-quality:fix');

-- Reviewer gets read only
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r, "Permission" p
WHERE r.name = 'reviewer'
  AND p.name = 'data-quality:read';
```

### 3.3 Verify Permissions

Test each role:

| Test | Method | Expected |
|------|--------|----------|
| Superadmin GET /summary | 200 | ✅ |
| Editor POST /scans | 201 | ✅ |
| Editor POST /issues/:id/fix | 200 | ✅ |
| Reviewer POST /scans | 403 | ✅ |
| Reviewer POST /issues/:id/fix | 403 | ✅ |
| Reviewer GET /summary | 200 | ✅ |

---

## 4. First Scan Procedure

After deployment, run the initial full scan to establish the baseline.

### 4.1 Dry Run First (Recommended)

```bash
curl -X POST https://your-domain.com/api/admin/data-quality/scans \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "type": "FULL",
    "dryRun": true,
    "batchSize": 100
  }'
```

Review the results:
- Check `issuesFound` — is the count reasonable?
- Any unexpected errors in `errorSummary`?

### 4.2 Full Scan

```bash
curl -X POST https://your-domain.com/api/admin/data-quality/scans \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "type": "FULL",
    "dryRun": false,
    "batchSize": 100
  }'
```

**Expected behavior for a catalog with ~8,000 phones:**
- Scan time: 5–15 minutes
- Batch count: ~80 batches
- Monitor via `GET /scans/:id`

### 4.3 Post-Scan Verification

```bash
# Check health score
curl -s https://your-domain.com/api/admin/data-quality/summary \
  -H "Cookie: your-auth-cookie" | jq '{
    healthScore,
    totalIssues: .issueCounts.open,
    criticalIssues: .severityBreakdown.critical
  }'
```

**Expected outcomes:**

| Metric | Healthy Range | Action if Outside |
|--------|--------------|-------------------|
| Health Score | 75–100 | Investigate top issue types |
| Critical Issues | 0–5 | Resolve immediately |
| High Issues | 0–100 | Prioritize this week |
| Total Open Issues | Varies by catalog size | Review and triage |

### 4.4 Triage First Results

1. Open the admin UI at `/admin/data-quality`
2. Go to the **Overview** tab — review the health score and category breakdown
3. Sort **All Issues** by severity — address CRITICAL issues first
4. Check **Duplicates** tab — review and merge obvious duplicates
5. Check **Import Warnings** — investigate any flagged imports

---

## 5. Scheduling Recurring Scans

### Recommended Schedule

| Scan Type | Frequency | Time | Notes |
|-----------|-----------|------|-------|
| Incremental | Daily | 03:00 UTC | Low-traffic window, catches daily changes |
| Full | Weekly | Sunday 02:00 UTC | Comprehensive check, slower |
| Post-Import | On-demand | After each import | Part of the import pipeline |

### Cron Setup (Linux)

```bash
# Edit crontab
crontab -e

# Daily incremental scan at 03:00 UTC
0 3 * * * curl -s -X POST https://your-domain.com/api/admin/data-quality/re-scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SYSTEM_TOKEN}" \
  -d '{"dryRun": false}' > /var/log/phonedock/daily-scan.log 2>&1

# Weekly full scan on Sunday at 02:00 UTC
0 2 * * 0 curl -s -X POST https://your-domain.com/api/admin/data-quality/scans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SYSTEM_TOKEN}" \
  -d '{"type": "FULL", "dryRun": false, "batchSize": 200}' > /var/log/phonedock/weekly-scan.log 2>&1
```

> **Note:** Use a system-level API token (not a user session cookie) for cron jobs. This token should have `data-quality:scan` permission.

---

## 6. Rollback Plan

### 6.1 Code Rollback

If issues are found with the new code:

```bash
# Revert to previous commit
git checkout <previous-release-tag>

# Rebuild and restart
npm install --production
npm run build
pm2 restart phonedock
```

**Impact:** The `/api/admin/data-quality/*` routes and `/admin/data-quality` page will return 404. The new database tables are harmless when unused.

### 6.2 Database Rollback

If you need to remove the new tables entirely:

```sql
-- WARNING: This permanently deletes all scan history and issue data
DROP TABLE IF EXISTS "DataQualityIssue" CASCADE;
DROP TABLE IF EXISTS "ScanJob" CASCADE;

-- Remove the migration record
DELETE FROM "_prisma_migrations"
WHERE migration_name = 'add_data_quality_tables';
```

**Re-applying** after rollback:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 6.3 Permission Rollback

```sql
DELETE FROM "RolePermission"
WHERE "permissionId" IN (
  SELECT id FROM "Permission" WHERE name LIKE 'data-quality:%'
);

DELETE FROM "Permission"
WHERE name LIKE 'data-quality:%';
```

### 6.4 Rollback Decision Matrix

| Symptom | Action | Urgency |
|---------|--------|---------|
| API returns 500 errors | Code rollback | Critical |
| Health score calculation wrong | Code fix + re-scan | High |
| Auto-fix corrupts data | Code rollback + manual data repair | Critical |
| Permissions not working | Re-run permission setup | High |
| UI rendering broken | Code rollback | Medium |
| Scan too slow | Increase batch size or schedule off-peak | Low |

---

## 7. Monitoring & Alerting

### 7.1 Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Health Score | `GET /summary` | < 50 (notify team) |
| Open Critical Issues | `GET /summary` | > 10 (page on-call) |
| Scan Duration | `ScanJob.completedAt - startedAt` | > 30 min (investigate) |
| Scan Failure Rate | Count of FAILED scans / total scans | > 10% (investigate) |
| Auto-Fix Failure Rate | Issues set to NEEDS_REVIEW / total fixes | > 5% (review rules) |

### 7.2 Log Messages to Watch

| Log Pattern | Severity | Meaning |
|-------------|----------|---------|
| `SCAN_FAILED` | ERROR | Scan job encountered unhandled error |
| `AUTO_FIX_FAILED` | WARN | Individual auto-fix failed, issue set to NEEDS_REVIEW |
| `BATCH_TIMEOUT` | WARN | Single batch took > 60 seconds |
| `DUPLICATE_GROUP_LARGE` | INFO | Found a duplicate group with 3+ phones (manual review) |
| `HEALTH_SCORE_CRITICAL` | ERROR | Health score dropped below 25 |

---

## 8. Known Limitations

| # | Limitation | Impact | Mitigation |
|---|-----------|--------|-----------|
| 1 | **No async URL validation** — `PHONE_IMAGE_BROKEN_URL` only checks URL format, not HTTP reachability | Broken URLs with valid format won't be caught | Schedule a separate async URL health check job |
| 2 | **Duplicate detection is name-based only** — doesn't use specification similarity | Spec-only duplicates (same phone, different name) missed | Manual review of import batches |
| 3 | **Health score is live-computed** — no caching | May be slow on catalogs with 100k+ issues | Add materialized view or cache layer if needed |
| 4 | **One scan at a time** — concurrent scans are blocked | Long-running full scans block incremental scans | Use ENTITY or IMPORT scans for targeted checks |
| 5 | **No undo for auto-fix** — while original values are stored in issue records, there's no one-click "undo auto-fix" button | Manual restoration needed if auto-fix was wrong | Review auto-fixable issues before bulk-fixing |
| 6 | **Import scan requires import tracking** — the import system must store `importId` on created entities | If imports don't set importId, import-specific scans won't find entities | Ensure import pipeline sets importId |
| 7 | **Price anomaly uses statistical threshold** — 3σ may produce false positives for brands with few phones | Small brand catalogs may flag normal prices | Lower minConfidence filter or ignore per-brand |
| 8 | **No cross-rule dependencies** — rules don't communicate with each other | A spec format fix might not trigger a re-check of other spec rules | Run a second scan after bulk fixes |
| 9 | **CSV export is synchronous** — large exports may timeout | Exports of 10,000+ issues may fail | Add streaming CSV or async export + download link |
| 10 | **Merge is not transactional across all relations** — if the process fails mid-merge, some assets may be partially transferred | Partial merge state requires manual cleanup | Check merge result and re-run if incomplete |

---

## 9. Performance Tuning

### For Catalogs Under 10,000 Phones

Default settings are sufficient. No tuning needed.

### For Catalogs 10,000–50,000 Phones

```json
{
  "batchSize": 200,
  "scanSchedule": "Daily incremental, monthly full"
}
```

### For Catalogs 50,000+ Phones

```json
{
  "batchSize": 500,
  "scanSchedule": "Daily incremental, quarterly full",
  "parallelRules": false,
  "databasePoolSize": 20
}
```

Additional recommendations:

1. **Add a `detectedAt` partition** if issue count exceeds 1M records
2. **Materialize the health score** as a database function or cron-computed cache
3. **Use read replicas** for the `/issues` and `/summary` endpoints
4. **Consider an async job queue** (BullMQ, Bull) for scan execution instead of in-process processing

---

## 10. Troubleshooting

### Scan hangs at "RUNNING" forever

```bash
# Check for stuck scans
SELECT "scanId", "status", "startedAt", "currentBatch", "lastProcessedId"
FROM "ScanJob"
WHERE "status" = 'RUNNING'
  AND "startedAt" < NOW() - INTERVAL '2 hours';

# Manual resolution: mark as FAILED
UPDATE "ScanJob"
SET "status" = 'FAILED',
    "completedAt" = NOW(),
    "errorSummary" = 'Manual intervention: scan timed out'
WHERE "scanId" = '<stuck-scan-id>';
```

### Duplicate issues being created for the same rule+entity

This indicates the partial unique index isn't working. Verify:

```sql
-- Check if the partial unique index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'DataQualityIssue'
  AND indexname LIKE '%issueKey%';
```

The index definition should include `WHERE ("status" IN ('OPEN'::"DataQualityIssueStatus", 'IGNORED'::"DataQualityIssueStatus', 'NEEDS_REVIEW'::"DataQualityIssueStatus'))`.

### Health score is 100 despite obvious issues

Check that issues are in `OPEN` status, not `IGNORED` or `RESOLVED`. The health score only counts `OPEN` issues.

### Auto-fix returns "NOT_AUTO_FIXABLE" for a rule you expect to be fixable

Verify the rule definition has `autoFixable: true` and implements the `fix()` function. See [DATA_QUALITY_RULES.md](./DATA_QUALITY_RULES.md) for the list of auto-fixable rules.

---

## 11. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| **Issue data exposure** — issues may contain entity data (currentValue, suggestedValue) | All endpoints require `data-quality:read`; data is not exposed on public API |
| **Auto-fix as destructive action** | Only safe fixes allowed; permission-gated; audit trail in `resolvedBy` and `resolution` |
| **CSV export data leakage** | Export requires authentication and `data-quality:read` permission |
| **Scan as DoS vector** | Rate-limited to 5 scan starts per 10 minutes; only one concurrent scan |
| **Merge as data destruction** | Validation prevents data loss; permission-gated; soft-delete only |
| **SQL injection via filters** | Prisma ORM uses parameterized queries; no raw SQL in filter inputs |

---

## 12. Checklist

Use this checklist for each deployment:

- [ ] Database migration applied successfully
- [ ] All 8 DataQualityIssue indexes confirmed
- [ ] All 2 ScanJob indexes confirmed
- [ ] Prisma client regenerated
- [ ] Application code deployed
- [ ] `GET /summary` returns 200
- [ ] `GET /issues` returns 200 with pagination
- [ ] Permissions registered in database
- [ ] Permissions assigned to roles
- [ ] Superadmin can access all endpoints
- [ ] Reviewer can only read
- [ ] Dry-run full scan completes without errors
- [ ] Full scan completes and produces issues
- [ ] Health score reflects scan results
- [ ] Admin UI loads at `/admin/data-quality`
- [ ] All 9 tabs render correctly
- [ ] Cron jobs configured (if applicable)
- [ ] Monitoring/alerting configured
- [ ] Rollback procedure documented and tested

---

*This document is part of the PhoneDock Data Quality Center documentation set.*