# PhoneDock Data Quality Center — System Report

> **Version:** 1.0.0  
> **Date:** 2025-01  
> **Component:** Admin Data Quality Module  
> **Status:** Production-Ready

---

## 1. Executive Summary

The PhoneDock Data Quality Center is a comprehensive, automated system for detecting, classifying, and resolving data integrity issues across the entire PhoneDock phone catalog database. It replaces manual spot-checks and ad-hoc scripts with a structured rules engine, scheduled scanning, and a unified admin interface.

The system provides:

- **20+ deterministic rules** covering phone identity, specifications, images, pricing, relationships, duplicates, and import anomalies
- **Batch scanning engine** with full, incremental, entity-specific, and import-targeted modes
- **Weighted 100-point health score** computed across 7 data quality categories
- **Safe auto-fix pipeline** that only applies deterministic, reversible corrections
- **Role-based access control** with four permission levels
- **Admin UI** with 9 tabbed views for issue triage, resolution, and monitoring

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Admin UI (/admin/data-quality)             │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────────┐  │
│  │ Overview │  Issues  │  Specs   │  Images  │  Prices  ... │  │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴──────┬───────┘  │
│       │          │          │          │           │           │
└───────┼──────────┼──────────┼──────────┼───────────┼───────────┘
        │          │          │          │           │
┌───────▼──────────▼──────────▼──────────▼───────────▼───────────┐
│                    API Layer (/api/admin/data-quality)          │
│  /summary  /scans  /issues  /bulk-fix  /export  /duplicates    │
└───────┬──────────┬──────────┬──────────┬───────────┬───────────┘
        │          │          │          │           │
┌───────▼──────────▼──────────▼──────────▼───────────▼───────────┐
│                    Service Layer                                │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ Scan Engine    │  │ Rules Engine   │  │ Health Scorer    │  │
│  │ (batch proc.)  │  │ (20+ rules)    │  │ (7 categories)   │  │
│  └───────┬────────┘  └───────┬────────┘  └────────┬─────────┘  │
│          │                   │                    │            │
│  ┌───────▼────────┐  ┌──────▼────────┐  ┌────────▼─────────┐  │
│  │ Auto-Fix       │  │ Dedup Engine  │  │ Export Service   │  │
│  │ (safe only)    │  │ (merge/flag)  │  │ (CSV)            │  │
│  └───────┬────────┘  └───────────────┘  └──────────────────┘  │
└──────────┼─────────────────────────────────────────────────────┘
           │
┌──────────▼─────────────────────────────────────────────────────┐
│                    Data Layer (Prisma ORM)                      │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ DataQualityIssue     │  │ ScanJob                        │  │
│  │ (issue records)      │  │ (scan lifecycle)               │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Data Models

#### DataQualityIssue

The central record representing a single detected quality problem.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String (cuid)` | Primary key |
| `issueKey` | `String` | Deterministic composite key: `{ruleId}:{entityType}:{entityId}:{field}` |
| `entityType` | `Enum` | `PHONE`, `PHONE_SPECIFICATION`, `PHONE_IMAGE`, `PHONE_BENCHMARK`, `BRAND`, `PRICE_TRACKER`, `IMPORT` |
| `entityId` | `String` | FK reference to the affected entity |
| `issueType` | `String` | Human-readable category (e.g., "Missing Field", "Invalid Format") |
| `severity` | `Enum` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `field` | `String?` | The specific field with the problem |
| `currentValue` | `String?` | Current (problematic) value |
| `suggestedValue` | `String?` | Recommended fix value |
| `source` | `String` | Rule ID that detected this issue |
| `confidence` | `Float` | 0.0–1.0 confidence in the detection |
| `status` | `Enum` | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `IGNORED`, `NEEDS_REVIEW` |
| `detectedAt` | `DateTime` | When the issue was first detected |
| `resolvedAt` | `DateTime?` | When it was resolved |
| `resolvedBy` | `String?` | User who resolved it |
| `resolution` | `String?` | Free-text resolution note |
| `importId` | `String?` | Link to import batch if issue originates from an import |
| `metadata` | `Json?` | Arbitrary rule-specific metadata |

**Unique Constraint:** `(issueKey, status)` where `status IN ('OPEN', 'IGNORED', 'NEEDS_REVIEW')` — prevents duplicate open issues for the same rule/entity/field combination.

**Indexes:**

| Index | Fields | Purpose |
|-------|--------|---------|
| Primary | `id` | Row lookup |
| Unique | `issueKey + status` (partial) | Deduplication of open issues |
| Status | `status` | Filter by state |
| Severity | `severity` | Filter by priority |
| Type | `issueType` | Filter by category |
| Entity | `entityType, entityId` | Look up issues for a specific entity |
| Import | `importId` | Trace issues to imports |
| Temporal | `detectedAt` | Time-range queries |

#### ScanJob

Tracks the lifecycle of a scan execution.

| Field | Type | Description |
|-------|------|-------------|
| `scanId` | `String (cuid)` | Primary key |
| `type` | `Enum` | `FULL`, `INCREMENTAL`, `ENTITY`, `IMPORT` |
| `status` | `Enum` | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `total` | `Int` | Total entities to process |
| `processed` | `Int` | Entities processed so far |
| `issuesFound` | `Int` | New issues detected in this scan |
| `issuesCreated` | `Int` | Issues actually persisted (after dedup) |
| `issuesResolved` | `Int` | Issues auto-resolved (stale issues no longer present) |
| `startedAt` | `DateTime?` | Scan start time |
| `completedAt` | `DateTime?` | Scan end time |
| `createdBy` | `String` | User who initiated the scan |
| `currentBatch` | `Int` | Current batch number |
| `batchSize` | `Int` | Entities per batch |
| `lastProcessedId` | `String?` | Cursor for resumable scans |
| `errorSummary` | `String?` | Aggregated error messages on failure |
| `dryRun` | `Boolean` | If true, detect but don't persist issues |
| `rules` | `Json?` | Which rules were active during this scan |

**Indexes:**

| Index | Fields | Purpose |
|-------|--------|---------|
| Status+Time | `status, createdAt` | Find active/recent scans |
| User+Time | `createdBy, createdAt` | User's scan history |

---

### 3.2 Rules Engine

The rules engine is the detection backbone. Each rule implements a uniform interface:

```
Rule {
  ruleId:        string          // e.g., "PHONE_MISSING_NAME"
  description:   string          // Human-readable description
  entityType:    EntityType      // Which entity type to scan
  severity:      Severity        // Default severity
  confidence:    number          // 0.0–1.0
  autoFixable:   boolean         // Whether auto-fix is safe
  detect(entity): Issue | null   // Detection function
  fix?(entity): FixResult        // Optional auto-fix function
}
```

Rules are organized into 7 domains:

| Domain | Rule Count | Examples |
|--------|-----------|----------|
| Phone Core Data | 5+ | Missing name, missing brand, empty slug, invalid status |
| Specifications | 4+ | Missing screen size, missing RAM, missing storage, invalid format |
| Images | 3+ | No images, no primary image, broken URLs |
| Benchmarks | 2+ | Missing benchmark data, stale benchmark scores |
| Brands | 2+ | Orphan brand (no phones), missing brand logo |
| Price Tracker | 3+ | No prices, stale prices, price anomaly detection |
| Imports | 3+ | Import with high failure rate, partial import, stale pending import |

Total: **20+ rules** (see [DATA_QUALITY_RULES.md](./DATA_QUALITY_RULES.md) for the full catalog).

---

### 3.3 Scanning Engine

The scanning engine orchestrates rule execution over the dataset with batch processing for large catalogs.

#### Scan Types

| Type | Scope | Use Case |
|------|-------|----------|
| `FULL` | Every entity in every tracked table | Initial setup, periodic deep clean |
| `INCREMENTAL` | Entities modified since last scan | Nightly scheduled runs |
| `ENTITY` | Single entity by type + ID | On-demand check after edit |
| `IMPORT` | All entities from a specific import batch | Post-import validation |

#### Batch Processing Flow

```
1. Create ScanJob record (status: PENDING)
2. Mark as RUNNING, record startedAt
3. For each batch:
   a. Fetch next `batchSize` entities (cursor = lastProcessedId)
   b. Run all applicable rules against each entity
   c. Upsert detected issues (respecting unique constraint)
   d. Mark stale issues as RESOLVED
   e. Update progress (processed, currentBatch, lastProcessedId)
4. On completion: set COMPLETED, record completedAt
5. On error: set FAILED, record errorSummary
```

**Default batch size:** 100 entities per batch.  
**Resumable:** If a scan fails mid-batch, it can be resumed from `lastProcessedId`.

---

### 3.4 Health Score

The health score provides a single, at-a-glance metric for data quality across the catalog.

#### Scoring Formula

```
Health Score (0–100) = Σ (Category Score × Category Weight)

Where Category Score = (1 - Issues in Category / Total Entities) × 100
```

#### Categories and Weights

| Category | Weight | Max Points | What It Measures |
|----------|--------|------------|-----------------|
| Core Identity | 20% | 20 pts | Missing names, brands, slugs, statuses |
| Specifications | 25% | 25 pts | Missing/incomplete spec fields |
| Images | 15% | 15 pts | Missing images, no primary, broken URLs |
| Prices | 15% | 15 pts | Missing prices, stale price data |
| Relationships | 10% | 10 pts | Orphan brands, broken references |
| Duplicates | 10% | 10 pts | Potential duplicate phones |
| Verification | 5% | 5 pts | Unverified data, low-confidence fields |

#### Score Interpretation

| Range | Grade | Meaning |
|-------|-------|---------|
| 90–100 | A | Excellent — minor issues only |
| 75–89 | B | Good — some gaps need attention |
| 50–74 | C | Fair — significant data gaps |
| 25–49 | D | Poor — major quality problems |
| 0–24 | F | Critical — immediate action required |

The score is computed live from issue counts — no caching layer — to ensure accuracy. For catalogs with 10,000+ phones, consider adding a materialized computation.

---

### 3.5 Auto-Fix Pipeline

Auto-fix is intentionally conservative. Only **safe, deterministic, reversible** fixes are applied.

#### What CAN Be Auto-Fixed

| Fix Type | Example | Reversibility |
|----------|---------|--------------|
| Whitespace cleanup | `" iPhone 15 "` → `"iPhone 15"` | Original stored in `currentValue` |
| Casing normalization | `"iphone 15 pro"` → `"iPhone 15 Pro"` | Title-case rules are deterministic |
| Primary image repair | Set first valid image as primary when none is flagged | Can be undone by clearing flag |
| Object-to-string conversion | `{value: "5G"}` → `"5G"` | Type coercion, data preserved |
| Null field defaulting | Set empty string to `null` where schema expects it | Original `null` was likely a bug |

#### What Will NEVER Be Auto-Fixed

| Category | Reason |
|----------|--------|
| Duplicate merging | Requires human judgment on which record to keep |
| Price changes | Financial data must be verified manually |
| Record deletion | Destructive and irreversible |
| Brand reassignment | Could cascade incorrectly |
| Specification value changes | Might reflect legitimate product differences |
| Status changes | Could affect public-facing catalog |

#### Auto-Fix Flow

```
POST /api/admin/data-quality/issues/:id/fix
  │
  ├─ Validate user has data-quality:fix permission
  ├─ Load issue, verify status is OPEN
  ├─ Verify issue.source rule has autoFixable: true
  ├─ Execute rule.fix(entity)
  │    ├─ Success → update entity, mark issue RESOLVED
  │    └─ Failure → mark issue NEEDS_REVIEW, log error
  └─ Return updated issue
```

Bulk fix applies the same logic across multiple issues in a single transaction, failing atomically if any fix fails.

---

## 4. API Layer

All endpoints live under `/api/admin/data-quality/` and require authentication.

| Endpoint | Method | Permission | Purpose |
|----------|--------|------------|---------|
| `/summary` | GET | `data-quality:read` | Health score, issue counts, recent scans |
| `/scans` | GET | `data-quality:read` | List scan history |
| `/scans` | POST | `data-quality:scan` | Start a new scan |
| `/scans/:id` | GET | `data-quality:read` | Get scan details + progress |
| `/issues` | GET | `data-quality:read` | List issues with filtering/pagination |
| `/issues/:id` | GET | `data-quality:read` | Single issue details |
| `/issues/:id/resolve` | POST | `data-quality:fix` | Manually resolve an issue |
| `/issues/:id/ignore` | POST | `data-quality:fix` | Ignore an issue |
| `/issues/:id/fix` | POST | `data-quality:fix` | Auto-fix a single issue |
| `/bulk-fix` | POST | `data-quality:fix` | Auto-fix multiple issues |
| `/export.csv` | GET | `data-quality:read` | Download issues as CSV |
| `/duplicates` | GET | `data-quality:read` | List potential duplicates |
| `/duplicates/:id/merge` | POST | `data-quality:fix` | Merge duplicate phones |
| `/re-scan` | POST | `data-quality:scan` | Trigger incremental re-scan |

Full endpoint documentation: [DATA_QUALITY_API.md](./DATA_QUALITY_API.md)

---

## 5. Permission Model

| Permission | Superadmin | Admin | Editor | Reviewer |
|------------|:----------:|:-----:|:------:|:--------:|
| `data-quality:read` | ✅ | ✅ | ✅ | ✅ |
| `data-quality:scan` | ✅ | ✅ | ✅ | ❌ |
| `data-quality:fix` | ✅ | ✅ | ✅ | ❌ |
| `data-quality:delete` | ✅ | ✅ | ❌ | ❌ |

**Reviewers** have read-only access. They can view issues and scans but cannot initiate fixes or scans. This is appropriate for QA staff who report issues but don't resolve them.

---

## 6. Admin UI

Located at `/admin/data-quality`, the UI provides 9 tabbed views:

| Tab | Content | Key Actions |
|-----|---------|-------------|
| **Overview** | Health score gauge, category breakdown, recent scan summary, top issues | Start scan, view trends |
| **All Issues** | Full issue list with filters (status, severity, type, entity) | Resolve, ignore, fix, bulk-fix, export |
| **Missing Specs** | Filtered view: `issueType` contains specification gaps | Fix individual or bulk |
| **Missing Images** | Filtered view: phones with no/insufficient images | Fix individual |
| **Missing Prices** | Filtered view: phones without price tracker entries | Flag for pricing team |
| **Duplicates** | Potential duplicate phone groups | Review, merge |
| **Orphans** | Orphan brands, unreferenced entities | Delete (with permission) |
| **Stale Prices** | Prices not updated within threshold | Flag for re-check |
| **Import Warnings** | Issues traced to specific import batches | Review import, re-run |
| **Scan History** | All scan jobs with status, timing, results | View details, re-run |

---

## 7. Data Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│  Admin User  │────▶│  Admin UI    │────▶│  API Routes         │
│  (browser)   │     │  (React)     │     │  (Next.js API)      │
└─────────────┘     └──────────────┘     └──────────┬──────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    │                  │                  │
                                    ▼                  ▼                  ▼
                            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                            │ Scan Engine  │  │ Issue Service│  │ Fix Service  │
                            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                                   │                 │                 │
                                   ▼                 │                 │
                            ┌──────────────┐         │                 │
                            │Rules Engine  │         │                 │
                            │ (20+ rules)  │         │                 │
                            └──────┬───────┘         │                 │
                                   │                 │                 │
                                   ▼                 ▼                 ▼
                            ┌──────────────────────────────────────────────┐
                            │              Database (Prisma)               │
                            │  ┌───────────────────┐ ┌──────────────────┐ │
                            │  │ DataQualityIssue  │ │ ScanJob          │ │
                            │  └───────────────────┘ └──────────────────┘ │
                            └──────────────────────────────────────────────┘
```

---

## 8. Key Design Decisions

### 8.1 Issue Key Uniqueness

The `issueKey` format (`{ruleId}:{entityType}:{entityId}:{field}`) combined with a partial unique index on open statuses ensures:

- The same rule never creates duplicate open issues for the same entity
- Resolved issues can be re-detected on the next scan (their new record gets a new `id` but the same `issueKey`)
- Ignored issues stay ignored until manually reopened

### 8.2 Confidence Scoring

Every rule produces a confidence score (0.0–1.0) indicating how certain the detection is. This enables:

- Filtering by confidence in the UI (show only high-confidence issues)
- Prioritizing auto-fix (only fix issues with confidence ≥ 0.95)
- Smart de-duplication (lower confidence duplicate matches require manual review)

### 8.3 No Soft Deletes on Issues

Issues are never deleted — they are resolved, ignored, or marked `NEEDS_REVIEW`. This preserves a full audit trail of data quality over time.

### 8.4 Import Traceability

Every issue can optionally link to an `importId`, allowing administrators to:

- See all issues introduced by a specific data import
- Assess import quality by counting issues per import
- Roll back or re-run problematic imports

---

## 9. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Large catalogs (50k+ phones) | Batch processing with configurable batch size; cursor-based pagination |
| Many open issues (100k+) | Indexed queries; pagination on `/issues` endpoint; filtered tab views reduce result sets |
| Health score computation | Live calculation from indexed counts; no joins required |
| Concurrent scans | Only one `RUNNING` scan allowed at a time; new requests queue or reject |
| Auto-fix transaction size | Bulk fix processes in transactions of 50; atomic rollback on failure |

---

## 10. Related Documentation

| Document | Description |
|----------|-------------|
| [DATA_QUALITY_RULES.md](./DATA_QUALITY_RULES.md) | Complete rules catalog with all 20+ rule definitions |
| [DATA_QUALITY_API.md](./DATA_QUALITY_API.md) | Full API reference with request/response shapes |
| [DATA_QUALITY_TEST_MATRIX.md](./DATA_QUALITY_TEST_MATRIX.md) | Testing requirements and test case catalog |
| [DATA_QUALITY_DEPLOYMENT.md](./DATA_QUALITY_DEPLOYMENT.md) | Deployment guide, indexes, permissions, rollback |

---

*This document is part of the PhoneDock Data Quality Center documentation set.*