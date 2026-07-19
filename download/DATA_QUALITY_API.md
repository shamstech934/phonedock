# PhoneDock Data Quality Center — API Reference

> **Base Path:** `/api/admin/data-quality`  
> **Authentication:** Required (session/JWT)  
> **Content-Type:** `application/json`

---

## Authentication & Authorization

All endpoints require an authenticated user with a valid session. Additionally, each endpoint requires specific permissions:

| Permission | Required For |
|------------|-------------|
| `data-quality:read` | All GET endpoints |
| `data-quality:scan` | `POST /scans`, `POST /re-scan` |
| `data-quality:fix` | `POST /issues/:id/resolve`, `POST /issues/:id/ignore`, `POST /issues/:id/fix`, `POST /bulk-fix`, `POST /duplicates/:id/merge` |
| `data-quality:delete` | Reserved for future issue deletion endpoint |

**Role Mapping:**

| Role | read | scan | fix | delete |
|------|:----:|:----:|:---:|:------:|
| Superadmin | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ❌ |
| Reviewer | ✅ | ❌ | ❌ | ❌ |

**Unauthorized Response (401/403):**

```json
{
  "error": "Unauthorized",
  "message": "You do not have permission to perform this action"
}
```

---

## Common Response Patterns

### Pagination

List endpoints support cursor-based pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cursor` | `string` | — | Cursor from previous response's `nextCursor` |
| `limit` | `number` | `50` | Items per page (max 200) |

**Paginated Response Envelope:**

```json
{
  "data": [...],
  "pagination": {
    "total": 1423,
    "cursor": "clx...",
    "nextCursor": "cly...",
    "hasMore": true
  }
}
```

### Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description of the problem",
  "details": {}
}
```

| HTTP Status | Error Code | When |
|-------------|-----------|------|
| 400 | `BAD_REQUEST` | Invalid parameters |
| 401 | `UNAUTHORIZED` | Not authenticated |
| 403 | `FORBIDDEN` | Missing permission |
| 404 | `NOT_FOUND` | Issue/scan not found |
| 409 | `CONFLICT` | Scan already running, issue already resolved |
| 422 | `VALIDATION_ERROR` | Request body fails validation |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Endpoints

### 1. GET `/summary`

Returns the data quality health score, issue breakdown, and recent scan summary.

**Permission:** `data-quality:read`

**Query Parameters:** None

**Response `200`:**

```json
{
  "healthScore": 78.5,
  "healthGrade": "C",
  "categoryScores": {
    "coreIdentity": { "score": 85, "weight": 20, "weighted": 17, "issues": 142 },
    "specifications": { "score": 62, "weight": 25, "weighted": 15.5, "issues": 891 },
    "images": { "score": 91, "weight": 15, "weighted": 13.65, "issues": 67 },
    "prices": { "score": 70, "weight": 15, "weighted": 10.5, "issues": 234 },
    "relationships": { "score": 95, "weight": 10, "weighted": 9.5, "issues": 12 },
    "duplicates": { "score": 88, "weight": 10, "weighted": 8.8, "issues": 45 },
    "verification": { "score": 72, "weight": 5, "weighted": 3.6, "issues": 198 }
  },
  "issueCounts": {
    "open": 1589,
    "inProgress": 23,
    "resolved": 4521,
    "ignored": 67,
    "needsReview": 12
  },
  "severityBreakdown": {
    "critical": 8,
    "high": 234,
    "medium": 891,
    "low": 456
  },
  "recentScan": {
    "scanId": "clxabc123...",
    "status": "COMPLETED",
    "completedAt": "2025-01-15T10:30:00Z",
    "issuesFound": 45,
    "issuesResolved": 23
  },
  "totalPhones": 8234,
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

---

### 2. GET `/scans`

List all scan jobs with optional filtering.

**Permission:** `data-quality:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `string` | Filter by scan status: `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `type` | `string` | Filter by scan type: `FULL`, `INCREMENTAL`, `ENTITY`, `IMPORT` |
| `createdBy` | `string` | Filter by user who initiated |
| `cursor` | `string` | Pagination cursor |
| `limit` | `number` | Items per page |

**Response `200`:**

```json
{
  "data": [
    {
      "scanId": "clxabc123...",
      "type": "FULL",
      "status": "COMPLETED",
      "total": 8234,
      "processed": 8234,
      "issuesFound": 156,
      "issuesCreated": 142,
      "issuesResolved": 23,
      "startedAt": "2025-01-15T09:00:00Z",
      "completedAt": "2025-01-15T10:30:00Z",
      "createdBy": "user_clx...",
      "currentBatch": 83,
      "batchSize": 100,
      "dryRun": false,
      "durationSeconds": 5400
    }
  ],
  "pagination": {
    "total": 47,
    "cursor": "clxabc123...",
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

### 3. POST `/scans`

Start a new scan job.

**Permission:** `data-quality:scan`

**Request Body:**

```json
{
  "type": "FULL",
  "dryRun": false,
  "batchSize": 100,
  "rules": ["PHONE_MISSING_NAME", "SPEC_MISSING_SCREEN_SIZE"],
  "options": {
    "entityType": null,
    "entityId": null,
    "importId": null
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | ✅ | `FULL`, `INCREMENTAL`, `ENTITY`, `IMPORT` |
| `dryRun` | `boolean` | ❌ | Default `false`. If `true`, detect issues but don't persist |
| `batchSize` | `number` | ❌ | Default `100`. Entities per batch (10–500) |
| `rules` | `string[]` | ❌ | Specific rule IDs to run. If omitted, runs all rules |
| `options.entityType` | `string` | Conditional | Required when `type: ENTITY` |
| `options.entityId` | `string` | Conditional | Required when `type: ENTITY` |
| `options.importId` | `string` | Conditional | Required when `type: IMPORT` |

**Response `201`:**

```json
{
  "scanId": "clxnew456...",
  "type": "FULL",
  "status": "PENDING",
  "message": "Scan job created and queued",
  "estimatedDuration": "90-120 minutes"
}
```

**Response `409` (Conflict):**

```json
{
  "error": "SCAN_ALREADY_RUNNING",
  "message": "A scan is already in progress. Wait for it to complete or cancel it before starting a new one.",
  "activeScan": {
    "scanId": "clxabc123...",
    "status": "RUNNING",
    "startedAt": "2025-01-15T09:00:00Z"
  }
}
```

---

### 4. GET `/scans/:id`

Get detailed information about a specific scan job.

**Permission:** `data-quality:read`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Scan ID (cuid) |

**Response `200`:**

```json
{
  "scanId": "clxabc123...",
  "type": "FULL",
  "status": "RUNNING",
  "total": 8234,
  "processed": 4100,
  "issuesFound": 78,
  "issuesCreated": 72,
  "issuesResolved": 12,
  "startedAt": "2025-01-15T09:00:00Z",
  "completedAt": null,
  "createdBy": "user_clx...",
  "currentBatch": 41,
  "batchSize": 100,
  "lastProcessedId": "phone_4100...",
  "errorSummary": null,
  "dryRun": false,
  "rules": null,
  "progress": {
    "percent": 49.8,
    "estimatedRemaining": "45 minutes",
    "entitiesPerSecond": 12.3
  }
}
```

**Response `404`:**

```json
{
  "error": "SCAN_NOT_FOUND",
  "message": "Scan job 'clxnonexistent' does not exist"
}
```

---

### 5. GET `/issues`

List data quality issues with comprehensive filtering.

**Permission:** `data-quality:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | `string` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `IGNORED`, `NEEDS_REVIEW`. Comma-separated for multiple |
| `severity` | `string` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`. Comma-separated |
| `issueType` | `string` | Filter by issue type (e.g., `Missing Field`) |
| `entityType` | `string` | Filter by entity type (`PHONE`, `BRAND`, etc.) |
| `entityId` | `string` | Filter by specific entity |
| `source` | `string` | Filter by rule ID |
| `importId` | `string` | Filter by import batch |
| `autoFixable` | `boolean` | Show only auto-fixable issues |
| `minConfidence` | `number` | Minimum confidence threshold (0.0–1.0) |
| `sortBy` | `string` | `detectedAt`, `severity`, `confidence`. Default: `detectedAt` |
| `sortOrder` | `string` | `asc` or `desc`. Default: `desc` |
| `cursor` | `string` | Pagination cursor |
| `limit` | `number` | Items per page (max 200) |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "dq_clx001...",
      "issueKey": "PHONE_MISSING_NAME:PHONE:phone_abc:NAME",
      "entityType": "PHONE",
      "entityId": "phone_abc",
      "issueType": "Missing Field",
      "severity": "CRITICAL",
      "field": "name",
      "currentValue": null,
      "suggestedValue": null,
      "source": "PHONE_MISSING_NAME",
      "confidence": 1.0,
      "status": "OPEN",
      "detectedAt": "2025-01-15T09:30:00Z",
      "resolvedAt": null,
      "resolvedBy": null,
      "resolution": null,
      "importId": null,
      "metadata": null,
      "autoFixable": false
    }
  ],
  "pagination": {
    "total": 1589,
    "cursor": "dq_clx001...",
    "nextCursor": "dq_clx002...",
    "hasMore": true
  }
}
```

---

### 6. GET `/issues/:id`

Get a single issue's full details.

**Permission:** `data-quality:read`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Issue ID (cuid) |

**Response `200`:**

```json
{
  "id": "dq_clx001...",
  "issueKey": "PHONE_EMPTY_SLUG:PHONE:phone_abc:slug",
  "entityType": "PHONE",
  "entityId": "phone_abc",
  "entity": {
    "id": "phone_abc",
    "name": "Samsung Galaxy S24 Ultra"
  },
  "issueType": "Missing Field",
  "severity": "HIGH",
  "field": "slug",
  "currentValue": null,
  "suggestedValue": "samsung-galaxy-s24-ultra",
  "source": "PHONE_EMPTY_SLUG",
  "confidence": 1.0,
  "status": "OPEN",
  "detectedAt": "2025-01-15T09:30:00Z",
  "resolvedAt": null,
  "resolvedBy": null,
  "resolution": null,
  "importId": null,
  "metadata": {
    "generatedFrom": "Samsung Galaxy S24 Ultra"
  },
  "autoFixable": true,
  "fixDescription": "Generate slug from phone name using slugify algorithm"
}
```

The response includes a hydrated `entity` object with the entity's current state for context.

---

### 7. POST `/issues/:id/resolve`

Manually resolve an issue with an optional resolution note.

**Permission:** `data-quality:fix`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Issue ID |

**Request Body:**

```json
{
  "resolution": "Phone name was added from GSMArena import batch #47",
  "status": "RESOLVED"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resolution` | `string` | ✅ | Explanation of how the issue was resolved |
| `status` | `string` | ❌ | Target status. Default: `RESOLVED`. Can also be `NEEDS_REVIEW` |

**Response `200`:**

```json
{
  "id": "dq_clx001...",
  "status": "RESOLVED",
  "resolvedAt": "2025-01-15T11:00:00Z",
  "resolvedBy": "user_clx...",
  "resolution": "Phone name was added from GSMArena import batch #47"
}
```

**Response `409`:**

```json
{
  "error": "ISSUE_ALREADY_CLOSED",
  "message": "This issue is already in RESOLVED status and cannot be resolved again"
}
```

---

### 8. POST `/issues/:id/ignore`

Ignore an issue. Ignored issues are excluded from the health score calculation.

**Permission:** `data-quality:fix`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Issue ID |

**Request Body:**

```json
{
  "reason": "This phone is a pre-release placeholder; name will be added at launch"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | `string` | ✅ | Why the issue is being ignored |

**Response `200`:**

```json
{
  "id": "dq_clx001...",
  "status": "IGNORED",
  "resolvedAt": "2025-01-15T11:00:00Z",
  "resolvedBy": "user_clx...",
  "resolution": "This phone is a pre-release placeholder; name will be added at launch"
}
```

**Note:** Ignored issues participate in the unique constraint. If the same issue is detected on a future scan, it will not create a new record (the existing IGNORED record will be found). To re-activate, the issue must first be set back to `OPEN` via a direct database update or a future API endpoint.

---

### 9. POST `/issues/:id/fix`

Auto-fix a single issue.

**Permission:** `data-quality:fix`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Issue ID |

**Request Body:** None (empty `{}`)

**Response `200` (Success):**

```json
{
  "id": "dq_clx001...",
  "status": "RESOLVED",
  "resolvedAt": "2025-01-15T11:05:00Z",
  "resolvedBy": "system:auto-fix",
  "resolution": "Auto-fixed: Generated slug 'samsung-galaxy-s24-ultra' from phone name",
  "fixApplied": {
    "field": "slug",
    "previousValue": null,
    "newValue": "samsung-galaxy-s24-ultra"
  }
}
```

**Response `422` (Not Auto-Fixable):**

```json
{
  "error": "NOT_AUTO_FIXABLE",
  "message": "Rule 'PHONE_MISSING_NAME' does not support auto-fix. Manual resolution required.",
  "issueId": "dq_clx001...",
  "ruleId": "PHONE_MISSING_NAME"
}
```

**Response `409` (Already Closed):**

```json
{
  "error": "ISSUE_NOT_OPEN",
  "message": "Cannot fix an issue that is not in OPEN status. Current status: RESOLVED"
}
```

---

### 10. POST `/bulk-fix`

Auto-fix multiple issues in a single request.

**Permission:** `data-quality:fix`

**Request Body:**

```json
{
  "issueIds": ["dq_clx001...", "dq_clx002...", "dq_clx003..."],
  "dryRun": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issueIds` | `string[]` | ✅ | Array of issue IDs to fix (max 100 per request) |
| `dryRun` | `boolean` | ❌ | Preview what would be fixed without applying. Default: `false` |

**Response `200` (All Fixed):**

```json
{
  "total": 3,
  "fixed": 3,
  "failed": 0,
  "skipped": 0,
  "results": [
    {
      "issueId": "dq_clx001...",
      "status": "fixed",
      "fixApplied": {
        "field": "slug",
        "previousValue": null,
        "newValue": "samsung-galaxy-s24-ultra"
      }
    },
    {
      "issueId": "dq_clx002...",
      "status": "fixed",
      "fixApplied": {
        "field": "name",
        "previousValue": "  iPhone 15  Pro ",
        "newValue": "iPhone 15 Pro"
      }
    },
    {
      "issueId": "dq_clx003...",
      "status": "fixed",
      "fixApplied": {
        "field": "processor",
        "previousValue": "{\"value\":\"A17 Pro\"}",
        "newValue": "A17 Pro"
      }
    }
  ]
}
```

**Response `200` (Partial Failure):**

```json
{
  "total": 3,
  "fixed": 2,
  "failed": 1,
  "skipped": 0,
  "results": [
    {
      "issueId": "dq_clx001...",
      "status": "fixed",
      "fixApplied": { "field": "slug", "previousValue": null, "newValue": "samsung-galaxy-s24-ultra" }
    },
    {
      "issueId": "dq_clx002...",
      "status": "failed",
      "error": "NOT_AUTO_FIXABLE",
      "message": "Rule 'PHONE_MISSING_NAME' does not support auto-fix"
    },
    {
      "issueId": "dq_clx003...",
      "status": "fixed",
      "fixApplied": { "field": "processor", "previousValue": "{\"value\":\"A17 Pro\"}", "newValue": "A17 Pro" }
    }
  ]
}
```

**Important:** Bulk fix processes issues individually. A failure on one issue does not roll back other fixes. Each fix is independently committed.

---

### 11. GET `/export.csv`

Export filtered issues as a CSV file.

**Permission:** `data-quality:read`

**Query Parameters:** Same filtering as `GET /issues` (status, severity, entityType, source, etc.)

**Response `200`:**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="data-quality-issues-2025-01-15.csv"
```

**CSV Columns:**

| Column | Source Field |
|--------|-------------|
| `Issue ID` | `id` |
| `Issue Key` | `issueKey` |
| `Entity Type` | `entityType` |
| `Entity ID` | `entityId` |
| `Issue Type` | `issueType` |
| `Severity` | `severity` |
| `Field` | `field` |
| `Current Value` | `currentValue` |
| `Suggested Value` | `suggestedValue` |
| `Source Rule` | `source` |
| `Confidence` | `confidence` |
| `Status` | `status` |
| `Detected At` | `detectedAt` |
| `Resolved At` | `resolvedAt` |
| `Resolved By` | `resolvedBy` |
| `Resolution` | `resolution` |
| `Import ID` | `importId` |
| `Auto-Fixable` | Derived from rule |
| `Entity Name` | Looked up from entity |

---

### 12. GET `/duplicates`

List potential duplicate phone groups.

**Permission:** `data-quality:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `minConfidence` | `number` | Minimum similarity confidence. Default: `0.5` |
| `brandId` | `string` | Filter to a specific brand |
| `status` | `string` | `OPEN`, `RESOLVED`, `IGNORED`. Default: `OPEN` |
| `cursor` | `string` | Pagination cursor |
| `limit` | `number` | Items per page |

**Response `200`:**

```json
{
  "data": [
    {
      "groupId": "dup_group_001",
      "phones": [
        {
          "id": "phone_abc",
          "name": "Samsung Galaxy S24 Ultra",
          "brand": "Samsung",
          "status": "ACTIVE",
          "imageCount": 5,
          "specCompleteness": 0.92,
          "priceCount": 3
        },
        {
          "id": "phone_def",
          "name": "Samsung Galaxy S24 Ultra ",
          "brand": "Samsung",
          "status": "ACTIVE",
          "imageCount": 2,
          "specCompleteness": 0.45,
          "priceCount": 0
        }
      ],
      "similarity": 0.95,
      "matchReason": "Normalized name match, same brand, same release year",
      "suggestedSurvivor": "phone_abc",
      "suggestedMergeTarget": "phone_def",
      "issueIds": ["dq_dup_001..."]
    }
  ],
  "pagination": {
    "total": 12,
    "hasMore": false
  }
}
```

The `suggestedSurvivor` is the phone with higher data completeness. The `suggestedMergeTarget` is the phone that would be merged into the survivor.

---

### 13. POST `/duplicates/:id/merge`

Merge a duplicate phone into the survivor phone.

**Permission:** `data-quality:fix`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | The `groupId` from `/duplicates` |

**Request Body:**

```json
{
  "survivorId": "phone_abc",
  "mergeTargetId": "phone_def",
  "strategy": "SURVIVOR_WINS",
  "transferAssets": {
    "images": true,
    "prices": true,
    "benchmarks": true,
    "specifications": "IF_MISSING"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `survivorId` | `string` | ✅ | Phone ID to keep |
| `mergeTargetId` | `string` | ✅ | Phone ID to merge (will be soft-deleted) |
| `strategy` | `string` | ❌ | `SURVIVOR_WINS` (default) or `FRESHEST_WINS` |
| `transferAssets.images` | `boolean` | ❌ | Transfer images from merge target to survivor. Default: `true` |
| `transferAssets.prices` | `boolean` | ❌ | Transfer prices. Default: `true` |
| `transferAssets.benchmarks` | `boolean` | ❌ | Transfer benchmarks. Default: `true` |
| `transferAssets.specifications` | `string` | ❌ | `ALWAYS`, `IF_MISSING` (default), `NEVER` |

**Response `200`:**

```json
{
  "survivorId": "phone_abc",
  "mergeTargetId": "phone_def",
  "status": "MERGED",
  "transferred": {
    "images": 2,
    "prices": 0,
    "benchmarks": 0,
    "specificationsFilled": 3
  },
  "relatedIssuesResolved": ["dq_dup_001..."],
  "mergedAt": "2025-01-15T11:30:00Z",
  "mergedBy": "user_clx..."
}
```

**Response `422`:**

```json
{
  "error": "MERGE_VALIDATION_FAILED",
  "message": "Cannot merge: merge target has 12 prices that would be lost (no survivor prices exist)",
  "details": {
    "conflictFields": ["prices"],
    "mergeTargetStats": { "priceCount": 12 },
    "survivorStats": { "priceCount": 0 }
  }
}
```

---

### 14. POST `/re-scan`

Trigger an incremental re-scan (convenience endpoint).

**Permission:** `data-quality:scan`

**Request Body:**

```json
{
  "dryRun": false,
  "rules": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dryRun` | `boolean` | ❌ | Default `false` |
| `rules` | `string[]` | ❌ | Specific rules to run. Default: all |

**Response `201`:** Same as `POST /scans` with `type: "INCREMENTAL"`.

This is a shorthand for `POST /scans` with `type: "INCREMENTAL"`. It always scans entities modified since the last completed scan.

---

## Rate Limiting

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Read endpoints (`GET`) | 120 requests | 1 minute |
| Scan triggers (`POST /scans`, `POST /re-scan`) | 5 requests | 10 minutes |
| Fix endpoints (`POST /issues/*/fix`, `POST /bulk-fix`) | 30 requests | 1 minute |
| Merge (`POST /duplicates/*/merge`) | 10 requests | 1 minute |

---

## Webhook Events (Future)

The following webhook events may be emitted by the Data Quality Center in a future release:

| Event | Trigger |
|-------|---------|
| `data-quality.scan.started` | Scan job begins processing |
| `data-quality.scan.completed` | Scan job finishes successfully |
| `data-quality.scan.failed` | Scan job fails |
| `data-quality.issue.created` | New issue detected |
| `data-quality.issue.resolved` | Issue resolved (manually or auto-fixed) |
| `data-quality.health.degraded` | Health score drops below 50 |
| `data-quality.duplicates.detected` | New duplicate group found |

---

*This document is part of the PhoneDock Data Quality Center documentation set.*