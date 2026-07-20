# PhoneDock Data Quality API Reference

> REST API reference for the Data Quality Center admin module.
> All endpoints require admin authentication via session/JWT.
> Base path: `/api/admin/data-quality/`

---

## Authentication & Permissions

All endpoints verify the admin session. Permission levels:

| Permission         | Endpoints Allowed                                      |
|--------------------|--------------------------------------------------------|
| `data-quality:read` | All GET endpoints                                     |
| `data-quality:scan` | POST scans, re-scan, scan execute                     |
| `data-quality:fix`  | POST resolve, ignore, fix, bulk-fix, merge            |
| `data-quality:delete` | POST cleanup                                         |

---

## GET Endpoints

### GET `/api/admin/data-quality/summary`

Returns the dashboard summary including health score, entity totals, issue counts by severity, queue counts, and trend data.

**Auth:** `data-quality:read`

**Query Parameters:**

| Param   | Type    | Default | Description                                    |
|---------|---------|---------|------------------------------------------------|
| `health`| `string`| `true`  | Set to `false` to skip health score calculation|

**Response:**

```json
{
  "health": {
    "score": 82,
    "categories": [
      {
        "name": "Core Identity",
        "score": 19.5,
        "deduction": 0.5,
        "maxDeduction": 20,
        "details": "3 missing brand"
      }
    ],
    "totals": {
      "totalPhones": 1250,
      "publishedPhones": 980,
      "draftPhones": 270
    }
  },
  "totals": {
    "totalPhones": 1250,
    "publishedPhones": 980,
    "draftPhones": 200,
    "archivedPhones": 70,
    "totalBrands": 45
  },
  "specs": {
    "withSpecs": 920,
    "completeSpecs": 850,
    "publishedPhones": 980
  },
  "queues": {
    "missingSpecs": 60,
    "missingImages": 30,
    "missingPrices": 15,
    "duplicates": 8,
    "orphans": 4,
    "stalePrices": 120,
    "failedImports": 2
  },
  "severity": {
    "critical": 2,
    "high": 18,
    "medium": 45,
    "low": 120,
    "info": 85,
    "total": 270
  },
  "trends": {
    "discoveredToday": 12,
    "fixedToday": 8,
    "newLast7Days": 65
  }
}
```

---

### GET `/api/admin/data-quality/rules`

Returns the full catalog of registered quality detection rules.

**Auth:** `data-quality:read`

**Response:**

```json
{
  "rules": [
    {
      "ruleId": "PHONE_MISSING_SPECS",
      "title": "Missing PhoneSpecs Document",
      "description": "Phone has no associated PhoneSpecs document",
      "severity": "high",
      "entityType": "phone",
      "canAutoFix": false
    }
  ],
  "total": 31
}
```

---

### GET `/api/admin/data-quality/stats`

Returns aggregate statistics for the issue tracker.

**Auth:** `data-quality:read`

**Response:**

```json
{
  "totalIssues": 1520,
  "openIssues": 270,
  "resolvedToday": 8,
  "autoFixed": 45,
  "byType": [
    { "issueType": "PHONE_STALE_PRICE", "count": 120 },
    { "issueType": "PHONE_MISSING_SPECS", "count": 60 },
    { "issueType": "IMPORT_LOW_CONFIDENCE", "count": 45 }
  ]
}
```

The `byType` array contains the top 20 open issue types sorted by count descending.

---

### GET `/api/admin/data-quality/issues`

Paginated list of quality issues with filtering, search, and sorting. Results are enriched with entity names (phone model name, brand name).

**Auth:** `data-quality:read`

**Query Parameters:**

| Param       | Type     | Default     | Description                                                    |
|-------------|----------|-------------|----------------------------------------------------------------|
| `page`      | `number` | `1`         | Page number (1-based)                                          |
| `limit`     | `number` | `50`        | Items per page (1–100)                                         |
| `severity`  | `string` | —           | Filter: `critical`, `high`, `medium`, `low`, `info`            |
| `issueType` | `string` | —           | Filter by rule ID. Supports comma-separated values for `$in`   |
| `status`    | `string` | `open`      | Filter: `open`, `ignored`, `resolved`, `auto_fixed`, `needs_review`, `false_positive`, `all` |
| `entityType`| `string` | —           | Filter: `phone`, `brand`, `phone_specs`, `phone_image`, `phone_price`, `phone_benchmark`, `import`, `price_source`, `retail_listing` |
| `importId`  | `string` | —           | Filter issues from a specific import job                       |
| `search`    | `string` | —           | Free-text search across `entityId`, `field`, and `issueType` (case-insensitive regex) |
| `sortBy`    | `string` | `detectedAt`| Sort field                                                      |
| `sortOrder` | `string` | `desc`      | `asc` or `desc`                                                |

**Response:**

```json
{
  "issues": [
    {
      "id": "64abc...",
      "issueKey": "PHONE_MISSING_SPECS:phone:64def...",
      "entityType": "phone",
      "entityId": "64def...",
      "entityName": "Samsung Galaxy S24 Ultra",
      "issueType": "PHONE_MISSING_SPECS",
      "severity": "high",
      "field": "specs",
      "currentValue": null,
      "suggestedValue": "Create PhoneSpecs document",
      "source": "system",
      "confidence": 1,
      "status": "open",
      "detectedAt": "2025-01-15T10:30:00Z",
      "resolvedAt": null,
      "importId": null,
      "metadata": {}
    }
  ],
  "total": 270,
  "page": 1,
  "pages": 6
}
```

---

### GET `/api/admin/data-quality/issues/:id`

Returns a single issue by its MongoDB `_id`.

**Auth:** `data-quality:read`

**Response:**

```json
{
  "issue": {
    "_id": "64abc...",
    "issueKey": "PHONE_MISSING_SPECS:phone:64def...",
    "entityType": "phone",
    "entityId": "64def...",
    ...
  }
}
```

Returns `404` if the issue is not found.

---

### GET `/api/admin/data-quality/scans`

Paginated list of scan jobs.

**Auth:** `data-quality:read`

**Query Parameters:**

| Param   | Type     | Default | Description        |
|---------|----------|---------|--------------------|
| `page`  | `number` | `1`     | Page number        |
| `limit` | `number` | `20`    | Items per page (1–50) |

**Response:**

```json
{
  "scans": [
    {
      "scanId": "64abc...",
      "type": "full",
      "status": "completed",
      "total": 1250,
      "processed": 1250,
      "issuesFound": 85,
      "issuesCreated": 12,
      "startedAt": "2025-01-15T10:00:00Z",
      "completedAt": "2025-01-15T10:02:30Z",
      "dryRun": false
    }
  ],
  "total": 15,
  "page": 1,
  "pages": 1
}
```

---

### GET `/api/admin/data-quality/scans/:id`

Returns details of a single scan job by `scanId`.

**Auth:** `data-quality:read`

**Response:**

```json
{
  "scan": {
    "scanId": "64abc...",
    "type": "incremental",
    "status": "running",
    "total": 45,
    "processed": 30,
    "currentBatch": 1,
    "batchSize": 100,
    "lastProcessedId": "64xyz...",
    "rules": ["PHONE_MISSING_SPECS", "PHONE_MISSING_PRICE"],
    ...
  }
}
```

Returns `404` if the scan is not found.

---

### GET `/api/admin/data-quality/duplicates`

Returns all open duplicate issues grouped by candidate set.

**Auth:** `data-quality:read`

**Response:**

```json
{
  "groups": [
    {
      "type": "PHONE_DUPLICATE_SLUG",
      "entities": [
        {
          "id": "64abc...",
          "modelName": "iPhone 15 Pro",
          "slug": "iphone-15-pro",
          "brandName": "Apple",
          "pricePKR": 450000
        }
      ],
      "issues": [
        {
          "id": "...",
          "issueKey": "PHONE_DUPLICATE_SLUG:phone:64abc...:slug",
          "entityId": "64abc...",
          ...
        }
      ]
    }
  ],
  "total": 3
}
```

Covers duplicate types: `PHONE_DUPLICATE_SLUG`, `PHONE_DUPLICATE_NORMALIZED`, `BRAND_DUPLICATE_NORMALIZED`, `SPECS_DUPLICATE`.

---

### GET `/api/admin/data-quality/export.csv`

Exports issues to a CSV file download.

**Auth:** `data-quality:read`

**Query Parameters:**

| Param       | Type     | Default  | Description                                  |
|-------------|----------|----------|----------------------------------------------|
| `status`    | `string` | `open`   | Filter by status (or `all`)                  |
| `issueType` | `string` | —        | Filter by rule ID                            |
| `severity`  | `string` | —        | Filter by severity level                     |

**Response:** `Content-Type: text/csv` with `Content-Disposition: attachment`.

CSV columns: `Issue Key, Entity Type, Entity ID, Issue Type, Severity, Field, Current Value, Suggested Value, Status, Detected At, Confidence, Import ID`

Maximum 10,000 rows exported. Objects are JSON-stringified. All values are properly CSV-escaped.

---

## POST Endpoints

### POST `/api/admin/data-quality/scans`

Start a new quality scan. By default, the scan is queued and immediately executed asynchronously.

**Auth:** `data-quality:scan`

**Request Body:**

```json
{
  "type": "full",
  "entityIds": [],
  "entityType": "",
  "importId": "",
  "dryRun": false,
  "rules": [],
  "execute": true
}
```

| Field        | Type       | Default | Description                                                       |
|--------------|------------|---------|-------------------------------------------------------------------|
| `type`       | `string`   | `full`  | Scan type: `full`, `incremental`, `entity`, `import`, `manual`   |
| `entityIds`  | `string[]` | `[]`    | For `entity` type: specific phone IDs to scan                     |
| `entityType` | `string`   | `""`    | Entity type filter                                                |
| `importId`   | `string`   | `""`    | For `import` type: the import job ID to scan phones from          |
| `dryRun`     | `boolean`  | `false` | If true, detect issues but do not persist them to the database    |
| `rules`      | `string[]` | `[]`    | Specific rule IDs to run (empty = all rules)                      |
| `execute`    | `boolean`  | `true`  | Set to `false` to queue without executing (separate POST execute) |

**Response:**

```json
{
  "scanId": "64abc...",
  "status": "queued"
}
```

Returns `400` for invalid scan type.

---

### POST `/api/admin/data-quality/scans/:id/execute`

Execute a previously queued scan job.

**Auth:** `data-quality:scan`

**Response:**

```json
{
  "scanId": "64abc...",
  "status": "running"
}
```

Returns `404` if scan not found, `409` if already running, `400` if already completed.

---

### POST `/api/admin/data-quality/issues/:id/resolve`

Manually resolve an issue.

**Auth:** `data-quality:fix`

**Request Body:**

```json
{
  "resolution": "Updated specs manually via admin panel"
}
```

The `resolution` field is truncated to 500 characters and defaults to `"Manually resolved"`.

**Response:**

```json
{
  "success": true
}
```

Returns `404` if issue not found. Creates an `ActivityLog` entry with action `data_quality_resolve`.

---

### POST `/api/admin/data-quality/issues/:id/ignore`

Mark an issue as ignored.

**Auth:** `data-quality:fix`

**Request Body:** None required.

**Response:**

```json
{
  "success": true
}
```

---

### POST `/api/admin/data-quality/issues/:id/fix`

Execute the auto-fix for a single issue (if the rule supports it).

**Auth:** `data-quality:fix`

**Request Body:**

```json
{
  "dryRun": false
}
```

**Response (success):**

```json
{
  "success": true,
  "dryRun": false,
  "changes": [
    { "field": "sortOrder", "oldValue": 0, "newValue": 1 }
  ]
}
```

**Response (error):**

```json
{
  "error": "This issue type does not support auto-fix"
}
```

Returns `400` if the rule doesn't support auto-fix or the fix fails.

---

### POST `/api/admin/data-quality/bulk-fix`

Apply a bulk action to multiple issues.

**Auth:** `data-quality:fix`

**Request Body:**

```json
{
  "issueIds": ["64abc...", "64def...", "64xyz..."],
  "action": "resolve",
  "dryRun": false
}
```

| Field      | Type        | Description                                              |
|------------|-------------|----------------------------------------------------------|
| `issueIds` | `string[]`  | Array of issue MongoDB `_id` values (max 500)            |
| `action`   | `string`    | One of: `resolve`, `ignore`, `fix`                       |
| `dryRun`   | `boolean`   | Preview mode (only affects `fix` action)                  |

**Response:**

```json
{
  "total": 3,
  "succeeded": 2,
  "failed": 1,
  "errors": ["64xyz...: This issue type does not support auto-fix"]
}
```

Creates an `ActivityLog` entry with action `data_quality_bulk_{action}`.

---

### POST `/api/admin/data-quality/re-scan`

Trigger a targeted re-scan of specific phone entities.

**Auth:** `data-quality:scan`

**Request Body:**

```json
{
  "entityIds": ["64abc...", "64def..."]
}
```

Maximum 100 entity IDs per request. Creates an `entity`-type scan internally.

**Response:**

```json
{
  "scanId": "64abc...",
  "status": "queued"
}
```

---

### POST `/api/admin/data-quality/duplicates/:id/merge`

Merge one duplicate phone into another (keep + absorb pattern).

**Auth:** `data-quality:fix`

**Request Body:**

```json
{
  "keepId": "64abc...",
  "mergeIntoId": "64def...",
  "dryRun": false
}
```

| Field          | Type      | Description                                        |
|----------------|-----------|----------------------------------------------------|
| `keepId`       | `string`  | ID of the phone to keep                           |
| `mergeIntoId`  | `string`  | ID of the phone to merge and soft-delete          |
| `dryRun`       | `boolean` | Preview what would be merged                       |

**Dry-run response:**

```json
{
  "dryRun": true,
  "keep": {
    "id": "64abc...",
    "modelName": "iPhone 15 Pro",
    "hasSpecs": true,
    "hasBench": false
  },
  "merge": {
    "id": "64def...",
    "modelName": "iPhone 15 Pro",
    "hasSpecs": false,
    "imageCount": 5,
    "wouldMoveImages": 5,
    "wouldMovePrices": 3,
    "wouldMoveBench": true,
    "wouldDelete": true
  }
}
```

**Live merge actions:**
1. Reassigns all `PhoneImage`, `PhonePrice`, and `PhoneBenchmark` records from `mergeIntoId` to `keepId`
2. If `keepId` has no specs but `mergeIntoId` does, the specs document is moved
3. If both have specs, the merged phone's specs are deleted
4. The merged phone is soft-deleted (`deletedAt` set, `status` set to `archived`)
5. Related duplicate issues are auto-resolved

Creates an `ActivityLog` entry with action `data_quality_merge`.

---

### POST `/api/admin/data-quality/cleanup`

Delete old resolved/auto-fixed/false-positive issues to prevent database bloat.

**Auth:** `data-quality:delete`

**Request Body:**

```json
{
  "olderThanDays": 30,
  "status": "resolved"
}
```

| Field            | Type     | Default    | Description                                                    |
|------------------|----------|------------|----------------------------------------------------------------|
| `olderThanDays`  | `number` | `30`       | Days threshold (1–365)                                         |
| `status`         | `string` | `resolved` | Target status: `resolved`, `auto_fixed`, or `false_positive`   |

**Response:**

```json
{
  "deleted": 245,
  "status": "resolved",
  "olderThanDays": 30
}
```

Issues are deleted where `resolvedAt < cutoff` or (if `resolvedAt` is null) `updatedAt < cutoff`.

Creates an `ActivityLog` entry with action `data_quality_cleanup`.

---

### POST `/api/admin/import-v2/jobs/:id/quality-scan`

Trigger a data quality scan specifically for phones created or updated by an import job.

**Auth:** `imports:execute`

**Path Parameters:**

| Param | Type     | Description          |
|-------|----------|----------------------|
| `id`  | `string` | The import job ID    |

**Request Body:** None required.

**Response:**

```json
{
  "scanId": "64abc...",
  "status": "queued"
}
```

Returns `404` if the import job is not found. The scan executes asynchronously.

---

## Error Responses

All endpoints return standard JSON errors:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning                                    |
|--------|--------------------------------------------|
| `400`  | Bad request (invalid params, validation)   |
| `401`  | Not authenticated                          |
| `403`  | Insufficient permissions                   |
| `404`  | Resource not found                         |
| `409`  | Conflict (scan already running)            |
| `500`  | Internal server error                      |

---

*Source: `src/app/api/[[...path]]/handlers/data-quality.ts`, `src/app/api/[[...path]]/handlers/import-v2.ts`*