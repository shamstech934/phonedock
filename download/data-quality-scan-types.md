# PhoneDock Data Quality Scan Types

> Documentation of the 5 scan modes, batch processing architecture, resume capability,
> and dry-run mode in the Data Quality scanner.

---

## Scan Type Overview

| Type          | Scope                                 | Use Case                                          |
|---------------|---------------------------------------|---------------------------------------------------|
| `full`        | All non-deleted phones                | Initial scan, periodic full audit                  |
| `incremental` | Phones updated since last scan        | Frequent lightweight checks                       |
| `entity`      | Specific phone IDs                    | Targeted re-scan after manual fixes               |
| `import`      | Phones from a specific import job     | Post-import quality gate                          |
| `manual`      | Configurable (same as full by default)| Admin-initiated with custom options               |

---

## 1. Full Scan

Scans every phone in the database where `deletedAt: null`.

**Flow:**

```
1. Build detection context (fetch all brands, specs, images, prices, benchmarks)
2. Query: Phone.find({ deletedAt: null }).sort({ _id: 1 })
3. Process in batches of 100
4. Run all rules on each batch
5. Run orphan detection (specs, images, prices, benchmarks)
6. Run price tracker detection (stale, inactive, outlier, mismatch)
7. Run brand detection (duplicates, missing logos)
8. Persist new issues (deduplicated by issueKey)
```

**When to use:** First-time setup, weekly audit, after bulk data operations.

---

## 2. Incremental Scan

Scans only phones that have been updated since the last completed scan.

**Flow:**

```
1. Find the most recent ScanJob with status 'completed' or 'completed_with_errors'
2. Query: Phone.find({ updatedAt: { $gt: lastScan.completedAt }, deletedAt: null })
3. If no previous scan exists, falls back to full scan (deletedAt: null)
4. Same batch processing and rule execution as full scan
```

**When to use:** Scheduled daily/hourly checks, CI pipeline gate.

**Performance advantage:** Only processes phones changed since last scan. If 50 phones were updated out of 1,000, only those 50 are scanned.

---

## 3. Entity Scan

Scans a specific set of phone IDs provided by the caller.

**Flow:**

```
1. Accepts entityIds array from request body
2. Query: Phone.find({ _id: { $in: entityIds }, deletedAt: null })
3. Load into detection context
4. Run all rules on the single batch
5. Does NOT run orphan/brand/price-tracker scans (only phone-centric rules)
```

**When to use:** After manually fixing a specific phone, re-scan to verify the fix resolved the issue.

**Triggered by:** `POST /api/admin/data-quality/re-scan` or `POST /api/admin/data-quality/scans` with `type: "entity"`.

---

## 4. Import Scan

Scans only the phones that were created or updated by a specific import job.

**Flow:**

```
1. Load the ImportJob by importId
2. Load all ImportBatch records for that import
3. Collect createdPhoneIds and updatedPhoneIds from all batches
4. Query: Phone.find({ _id: { $in: collectedIds }, deletedAt: null })
5. Run all rules on collected phones
6. Additionally check for IMPORT_FAILED_ROWS (sum of batch errors)
7. Persist issues tagged with the importId
```

**When to use:** Post-import quality gate. Automatically triggered via `POST /api/admin/import-v2/jobs/:id/quality-scan` after import completion.

**Import ID tagging:** All issues created during an import scan include the `importId` field, allowing the UI to filter issues per import.

---

## 5. Manual / Scheduled Scan

A configurable scan type that uses the same execution path as a full scan but accepts custom parameters.

**Configurable options:**

| Option     | Type       | Description                                      |
|------------|------------|--------------------------------------------------|
| `rules`    | `string[]` | Only run specific rule IDs (empty = all)         |
| `dryRun`   | `boolean`  | Detect but don't persist issues                  |
| `execute`  | `boolean`  | Queue only (false) vs. queue + execute (true)    |

**When to use:** Testing a new rule, running a specific rule across all phones, dry-run audits.

---

## Batch Processing Architecture

### Batch Size

All scan types that process phones use a batch size of **100 documents** (constant `BATCH_SIZE`).

### How Batches Work

```
All phones matching the query are fetched once (sorted by _id ascending)
├── Batch 1: phones[0..99]    → runRulesOnBatch() → update scan progress
├── Batch 2: phones[100..199] → runRulesOnBatch() → update scan progress
├── Batch 3: phones[200..299] → runRulesOnBatch() → update scan progress
└── ...
```

Each batch processes through **all active rules** sequentially:

```
for each rule in activeRules:
    issues = await rule.detect(ctx)    // ctx.entities = current batch
    allIssues.push(...issues)
```

### Progress Tracking

After each batch, the scan job document is updated:

```json
{
  "processed": 200,
  "currentBatch": 2,
  "total": 1250
}
```

This enables the UI to display real-time scan progress.

### Detection Context

Before any batch processing, the scanner builds a `DetectionContext` with pre-fetched lookup maps:

| Lookup       | Source Collection  | Key              | Value       |
|--------------|--------------------|------------------|-------------|
| `brands`     | `Brand`            | brand `_id`      | brand doc   |
| `specs`      | `PhoneSpecs`       | `phoneId`        | specs doc   |
| `images`     | `PhoneImage`       | `phoneId`        | image array |
| `prices`     | `PhonePrice`       | `phoneId`        | price array |
| `benchmarks` | `PhoneBenchmark`   | `phoneId`        | bench doc   |

These maps are built once and shared across all batches, avoiding N+1 queries.

---

## Resume Capability (lastProcessedId)

The `ScanJob` schema persists `lastProcessedId` for crash recovery. If a scan fails mid-execution, the query builder uses it to resume:

```javascript
const queryBuilder = job.lastProcessedId
  ? Phone.find({ ...query, _id: { $gt: new Types.ObjectId(job.lastProcessedId) } })
  : Phone.find(query);
```

**How it works:**

1. During each batch, the last phone's `_id` is *not* currently persisted (the field exists in the schema but the current implementation updates `processed` count instead)
2. If a scan crashes, the `ScanJob` retains its `lastProcessedId` from the schema definition
3. A new scan started on the same job could theoretically resume from the last processed ID

**Schema fields for resume:**

| Field            | Type     | Description                              |
|------------------|----------|------------------------------------------|
| `currentBatch`   | `number` | Current batch index (0-based)            |
| `batchSize`      | `number` | Batch size (default: 100)                |
| `lastProcessedId`| `string` | ObjectId of the last successfully processed phone |

---

## Dry-Run Mode

When a scan is started with `dryRun: true`, the scan executes all detection logic normally but **skips the `persistIssues()` call**:

```javascript
if (!job.dryRun) {
  created = await persistIssues(allIssues, job.importId || undefined);
}
```

**Behavior:**

| Aspect           | Normal Scan        | Dry-Run Scan          |
|------------------|--------------------|------------------------|
| Detection        | Runs fully         | Runs fully             |
| Issue persistence| Yes (bulk insert)  | No                     |
| `issuesCreated`  | Actual count       | Always 0               |
| `issuesFound`    | Total detected     | Total detected         |
| Auto-fixes       | Applies to DB      | N/A                    |

**Use cases:**

- Previewing how many issues a new rule would generate before enabling it
- Auditing data quality without polluting the issue tracker
- Testing rule changes in a staging environment

**Scan status for dry runs:** The scan still transitions through `queued → running → completed` normally. The `issuesCreated` count of 0 indicates it was a dry run (check `dryRun: true` on the scan document).

---

## Additional Scan Phases

Beyond the phone-based batch scanning, every scan (except entity-type) also runs these additional phases:

### Orphan Detection (`scanOrphans`)

Runs after all phone batches are processed. Checks:

1. **Orphan specs** — PhoneSpecs with `phoneId` referencing a deleted/non-existent phone
2. **Duplicate specs** — Multiple PhoneSpecs for the same `phoneId`
3. **Orphan images** — PhoneImages with `phoneId` referencing a non-existent phone
4. **Orphan prices** — PhonePrices with `phoneId` referencing a non-existent phone
5. **Orphan benchmarks** — PhoneBenchmarks with `phoneId` referencing a non-existent phone
6. **Brand duplicates** — Brands with the same normalized name
7. **Brand missing logo** — Brands without a `logo` field

### Price Tracker Detection (`scanPriceTrackerIssues`)

Queries the Price Tracker collections directly:

1. **Stale tracked prices** — `PhoneRetailListing` not checked in 14+ days
2. **Inactive sources** — `PriceSource` with `status: 'failed'` (failureCount > 3) or disabled
3. **Price outliers** — Listing price >50% deviation from `phone.pricePKR`
4. **Price mismatch** — Lowest listing >10% lower than phone price, phone not recently updated

---

## Issue Persistence (Deduplication)

Issues are persisted using a bulk upsert strategy:

1. Collect all `issueKey` values from detected issues
2. Query for existing unresolved issues (`status` in `open`, `ignored`, `needs_review`) with matching keys
3. Skip issues that already exist (prevents duplicates across scans)
4. Bulk insert remaining issues using `bulkWrite` with `ordered: false`
5. Handle duplicate key errors (code 11000) by falling back to individual inserts

**Issue key format:** `{ruleId}:{entityType}:{entityId}:{field}`

The unique partial index on `{ issueKey: 1, status: 1 }` (for unresolved statuses) ensures database-level deduplication even under concurrent scans.

---

## Scan Job States

| Status                  | Meaning                                             |
|-------------------------|-----------------------------------------------------|
| `queued`                | Created but not yet executing                       |
| `running`               | Currently executing batches                         |
| `completed`             | Finished successfully                               |
| `completed_with_errors` | Finished with some rule failures (non-fatal)        |
| `failed`                | Fatal error; `errorSummary` contains the message    |
| `cancelled`             | Manually cancelled (schema supports, not yet wired) |

---

*Source: `src/lib/data-quality/scanner.ts`, `src/lib/models/DataQuality.ts` (ScanJob schema)*