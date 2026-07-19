# PhoneDock Data Quality Center — Test Matrix

> **Version:** 1.0.0  
> **Total Test Cases:** 87  
> **Test Levels:** Unit, Integration, E2E  

---

## Test Organization

Tests are organized into 6 domains. Each test case has a unique ID, a clear description, preconditions, expected result, and priority.

### Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must pass — blocks release |
| **P1** | Should pass — high-priority bug if failing |
| **P2** | Nice to have — acceptable to defer |
| **P3** | Edge case — low risk |

### Status Tracking

| Status | Meaning |
|--------|---------|
| ⬜ Not started | |
| 🔄 In progress | |
| ✅ Passing | |
| ❌ Failing | |
| ⏭ Skipped | Deferred or N/A |

---

## 1. Detection Tests

Tests that verify each rule correctly detects (or does not detect) issues.

### 1.1 Phone Core Data Rules

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| DET-001 | PHONE_MISSING_NAME: Detect phone with `null` name | Phone record with `name: null` | Issue created, severity CRITICAL, confidence 1.0 | P0 | ⬜ |
| DET-002 | PHONE_MISSING_NAME: Detect phone with empty string name | Phone record with `name: ""` | Issue created | P0 | ⬜ |
| DET-003 | PHONE_MISSING_NAME: Detect phone with whitespace-only name | Phone record with `name: "   "` | Issue created | P0 | ⬜ |
| DET-004 | PHONE_MISSING_NAME: No false positive on valid name | Phone record with `name: "iPhone 15 Pro"` | No issue created | P0 | ⬜ |
| DET-005 | PHONE_MISSING_BRAND: Detect phone with `null` brandId | Phone record with `brandId: null` | Issue created, severity HIGH | P0 | ⬜ |
| DET-006 | PHONE_MISSING_BRAND: Detect phone with non-existent brandId | Phone record with `brandId: "nonexistent"` | Issue created, severity HIGH | P1 | ⬜ |
| DET-007 | PHONE_MISSING_BRAND: No false positive on valid brand | Phone with valid `brandId` referencing existing brand | No issue created | P0 | ⬜ |
| DET-008 | PHONE_EMPTY_SLUG: Detect phone with `null` slug | Phone with `slug: null`, `name: "Samsung Galaxy S24"` | Issue created, suggestedValue: `"samsung-galaxy-s24"` | P0 | ⬜ |
| DET-009 | PHONE_EMPTY_SLUG: Detect phone with empty slug | Phone with `slug: ""` | Issue created | P0 | ⬜ |
| DET-010 | PHONE_EMPTY_SLUG: Detect phone with invalid slug format | Phone with `slug: "Samsung Galaxy!"` | Issue created | P1 | ⬜ |
| DET-011 | PHONE_EMPTY_SLUG: No false positive on valid slug | Phone with `slug: "iphone-15-pro"` | No issue created | P0 | ⬜ |
| DET-012 | PHONE_INVALID_STATUS: Detect unexpected status value | Phone with `status: "UNKNOWN"` | Issue created, severity MEDIUM, confidence 0.95 | P1 | ⬜ |
| DET-013 | PHONE_INVALID_STATUS: No false positive on valid statuses | Phone with `status: "ACTIVE"` | No issue created | P1 | ⬜ |
| DET-014 | PHONE_NAME_WHITESPACE: Detect leading/trailing whitespace | Phone with `name: "  iPhone 15 Pro  "` | Issue created, severity LOW, confidence 1.0 | P1 | ⬜ |
| DET-015 | PHONE_NAME_WHITESPACE: Detect multiple internal spaces | Phone with `name: "Samsung  Galaxy  S24"` | Issue created | P1 | ⬜ |
| DET-016 | PHONE_NAME_WHITESPACE: No false positive on clean name | Phone with `name: "iPhone 15 Pro"` | No issue created | P1 | ⬜ |

### 1.2 Specification Rules

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| DET-017 | SPEC_MISSING_SCREEN_SIZE: Detect null screen size | Spec record with `screenSize: null` | Issue created, severity HIGH | P0 | ⬜ |
| DET-018 | SPEC_MISSING_SCREEN_SIZE: No false positive on valid | Spec with `screenSize: "6.7"` | No issue created | P0 | ⬜ |
| DET-019 | SPEC_MISSING_RAM: Detect null RAM | Spec with `ram: null` | Issue created, severity MEDIUM, confidence 0.9 | P1 | ⬜ |
| DET-020 | SPEC_MISSING_STORAGE: Detect null storage | Spec with `storage: null` | Issue created, severity MEDIUM, confidence 0.9 | P1 | ⬜ |
| DET-021 | SPEC_INVALID_FORMAT: Detect object value where string expected | Spec with `processor: {"value": "A17 Pro"}` | Issue created, confidence 0.95, autoFixable true | P0 | ⬜ |
| DET-022 | SPEC_INVALID_FORMAT: Detect array value | Spec with `os: ["iOS 17", "iOS 18"]` | Issue created | P1 | ⬜ |
| DET-023 | SPEC_INVALID_FORMAT: No false positive on valid string | Spec with `processor: "A17 Pro"` | No issue created | P0 | ⬜ |

### 1.3 Image Rules

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| DET-024 | PHONE_NO_IMAGES: Detect phone with zero images | Phone with no PhoneImage records | Issue created, severity HIGH | P0 | ⬜ |
| DET-025 | PHONE_NO_IMAGES: No false positive with images | Phone with 3 PhoneImage records | No issue created | P0 | ⬜ |
| DET-026 | PHONE_NO_PRIMARY_IMAGE: Detect no primary among images | Phone with 3 images, none `isPrimary: true` | Issue created, severity MEDIUM, autoFixable true | P0 | ⬜ |
| DET-027 | PHONE_NO_PRIMARY_IMAGE: No false positive with primary | Phone with 3 images, one `isPrimary: true` | No issue created | P0 | ⬜ |
| DET-028 | PHONE_IMAGE_BROKEN_URL: Detect null URL | PhoneImage with `url: null` | Issue created, severity MEDIUM, confidence 0.85 | P1 | ⬜ |
| DET-029 | PHONE_IMAGE_BROKEN_URL: Detect empty string URL | PhoneImage with `url: ""` | Issue created | P1 | ⬜ |
| DET-030 | PHONE_IMAGE_BROKEN_URL: Detect malformed URL | PhoneImage with `url: "not-a-url"` | Issue created | P2 | ⬜ |
| DET-031 | PHONE_IMAGE_BROKEN_URL: No false positive on valid URL | PhoneImage with `url: "https://cdn.example.com/phone.jpg"` | No issue created | P1 | ⬜ |

### 1.4 Benchmark, Brand, Price, Import, Duplicate Rules

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| DET-032 | BENCHMARK_MISSING_DATA: Detect no benchmarks for active phone | Active phone with no PhoneBenchmark | Issue created, severity LOW, confidence 0.8 | P2 | ⬜ |
| DET-033 | BENCHMARK_STALE_DATA: Detect benchmark older than 365 days | PhoneBenchmark with `createdAt` > 365 days ago | Issue created, confidence 0.7 | P2 | ⬜ |
| DET-034 | BRAND_ORPHAN: Detect brand with zero phones | Brand with no Phone records referencing it | Issue created, severity LOW | P2 | ⬜ |
| DET-035 | BRAND_ORPHAN: No false positive with phones | Brand with 5 phones | No issue created | P2 | ⬜ |
| DET-036 | BRAND_MISSING_LOGO: Detect brand with phones but no logo | Brand with phones, `logoUrl: null` | Issue created, confidence 0.9 | P2 | ⬜ |
| DET-037 | PRICE_MISSING: Detect active phone with no prices | Active phone with no PriceTracker records | Issue created, severity HIGH | P0 | ⬜ |
| DET-038 | PRICE_STALE: Detect price older than 30 days | PriceTracker for active phone, `updatedAt` > 30 days ago | Issue created, severity MEDIUM | P1 | ⬜ |
| DET-039 | PRICE_ANOMALY: Detect price > 3 std dev from category mean | PriceTracker with price way outside normal range for category | Issue created, confidence 0.6 | P2 | ⬜ |
| DET-040 | IMPORT_HIGH_FAILURE_RATE: Detect import with > 25% failures | Import with 250 failed / 1000 total rows | Issue created, severity HIGH | P1 | ⬜ |
| DET-041 | IMPORT_PARTIAL: Detect import stuck in RUNNING > 24h | Import with status RUNNING, createdAt > 24h ago | Issue created, severity MEDIUM | P1 | ⬜ |
| DET-042 | IMPORT_STALE_PENDING: Detect import PENDING > 1h | Import with status PENDING, createdAt > 1h ago | Issue created, severity LOW | P2 | ⬜ |
| DET-043 | PHONE_DUPLICATE_SUSPECT: Detect near-duplicate names | Two phones, same brand, names "Galaxy S24" and "Galaxy S24 " | Issue created, confidence 0.6 | P1 | ⬜ |
| DET-044 | PHONE_DUPLICATE_SUSPECT: No false positive on distinct phones | "Galaxy S24" vs "Galaxy S24 Ultra" | No issue created | P0 | ⬜ |
| DET-045 | PHONE_DUPLICATE_SUSPECT: No false positive across brands | "Pixel 8" (Google) vs "Pixel 8" (some other brand, if exists) | No issue created — brand must match | P1 | ⬜ |

---

## 2. Scanning Tests

Tests that verify the scan lifecycle, batch processing, and deduplication.

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| SCAN-001 | Full scan creates ScanJob with type FULL | Empty scan history, 50 phones in DB | ScanJob created, status PENDING, total: 50 | P0 | ⬜ |
| SCAN-002 | Full scan processes all entities | 50 phones, 10 brands, 200 specs | Scan completes, processed = total | P0 | ⬜ |
| SCAN-003 | Full scan detects expected issues | Phone with null name in DB | Issue PHONE_MISSING_NAME created | P0 | ⬜ |
| SCAN-004 | Full scan updates progress during execution | Large dataset (500+ entities) | `currentBatch` and `processed` increment correctly | P1 | ⬜ |
| SCAN-005 | Full scan marks stale issues as RESOLVED | Issue exists for field that is now valid | Previous issue set to RESOLVED | P0 | ⬜ |
| SCAN-006 | Full scan respects batch size | `batchSize: 10`, 50 entities | 5 batches processed | P1 | ⬜ |
| SCAN-007 | Incremental scan only checks modified entities | 3 phones modified since last scan | Only 3 entities processed | P0 | ⬜ |
| SCAN-008 | Incremental scan with no modifications | No entities modified since last scan | Scan completes with 0 processed, 0 issues | P1 | ⬜ |
| SCAN-009 | Entity scan checks single entity | `entityType: PHONE, entityId: "phone_abc"` | Only that phone is scanned | P1 | ⬜ |
| SCAN-010 | Import scan checks entities from specific import | Import with 20 phones | Only those 20 phones scanned | P1 | ⬜ |
| SCAN-011 | Dry run scan does not persist issues | `dryRun: true`, phone with null name | Scan completes, `issuesCreated: 1` but no DB records | P0 | ⬜ |
| SCAN-012 | Specific rules filter works | `rules: ["PHONE_MISSING_NAME"]` | Only PHONE_MISSING_NAME rule runs | P1 | ⬜ |
| SCAN-013 | Concurrent scan prevention | One scan already RUNNING | Second scan returns 409 CONFLICT | P0 | ⬜ |
| SCAN-014 | Scan failure records error summary | Rule throws exception mid-scan | Scan status FAILED, errorSummary populated | P0 | ⬜ |
| SCAN-015 | Scan resumable from lastProcessedId | Scan fails at batch 5 of 10 | Re-started scan resumes from batch 5 | P1 | ⬜ |
| SCAN-016 | Issue dedup within scan | Same rule detects same issue twice | Only one issue record created (unique constraint) | P0 | ⬜ |
| SCAN-017 | Scan duration recorded correctly | Scan runs for 5 minutes | `completedAt - startedAt` ≈ 5 minutes | P1 | ⬜ |

---

## 3. Fix Tests

Tests that verify auto-fix behavior, safety constraints, and manual resolution.

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| FIX-001 | Auto-fix PHONE_EMPTY_SLUG generates correct slug | Issue for phone "Samsung Galaxy S24" with null slug | Slug set to "samsung-galaxy-s24", issue RESOLVED | P0 | ⬜ |
| FIX-002 | Auto-fix PHONE_NAME_WHITESPACE trims name | Issue for "  iPhone 15  Pro  " | Name set to "iPhone 15 Pro", issue RESOLVED | P0 | ⬜ |
| FIX-003 | Auto-fix PHONE_NO_PRIMARY_IMAGE sets first as primary | 3 images, none primary | First image `isPrimary: true`, issue RESOLVED | P0 | ⬜ |
| FIX-004 | Auto-fix SPEC_INVALID_FORMAT extracts string | Processor is `{"value": "A17 Pro"}` | Processor set to "A17 Pro", issue RESOLVED | P0 | ⬜ |
| FIX-005 | Auto-fix SPEC_INVALID_FORMAT handles array | OS is `["iOS 17"]` | OS set to "iOS 17", issue RESOLVED | P1 | ⬜ |
| FIX-006 | Auto-fix rejected for non-auto-fixable rule | Issue with source PHONE_MISSING_NAME | Returns 422 NOT_AUTO_FIXABLE | P0 | ⬜ |
| FIX-007 | Auto-fix rejected for already-resolved issue | Issue in RESOLVED status | Returns 409 ISSUE_NOT_OPEN | P0 | ⬜ |
| FIX-008 | Auto-fix rejected for ignored issue | Issue in IGNORED status | Returns 409 ISSUE_NOT_OPEN | P1 | ⬜ |
| FIX-009 | Auto-fix sets resolvedBy to system:auto-fix | Valid auto-fixable issue | `resolvedBy: "system:auto-fix"` | P1 | ⬜ |
| FIX-010 | Auto-fix records fix details in resolution | Slug fix applied | Resolution includes old/new value details | P1 | ⬜ |
| FIX-011 | Auto-fix failure sets NEEDS_REVIEW | Fix function throws unexpected error | Issue status set to NEEDS_REVIEW | P0 | ⬜ |
| FIX-012 | Bulk fix applies all fixable issues | 3 auto-fixable issues in request | All 3 resolved | P0 | ⬜ |
| FIX-013 | Bulk fix skips non-fixable issues | 2 fixable + 1 non-fixable in request | 2 fixed, 1 failed | P0 | ⬜ |
| FIX-014 | Bulk fix max 100 issue IDs | Request with 101 issueIds | Returns 400 BAD_REQUEST | P1 | ⬜ |
| FIX-015 | Bulk fix dry run previews without applying | `dryRun: true` with 3 issues | All 3 reported as "would fix", no DB changes | P1 | ⬜ |
| FIX-016 | Manual resolve records resolution text | POST /issues/:id/resolve with resolution note | Issue RESOLVED, resolution text saved | P0 | ⬜ |
| FIX-017 | Manual ignore excludes from health score | Issue IGNORED | Health score no longer penalized by this issue | P0 | ⬜ |
| FIX-018 | Slug uniqueness enforced during auto-fix | Phone "iPhone 15" slug conflict with existing "iphone-15" | Slug appended with suffix: "iphone-15-2" | P0 | ⬜ |

---

## 4. Duplicate Tests

Tests for duplicate detection and merge functionality.

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| DUP-001 | Duplicate detection groups similar phones | 2 phones: "Galaxy S24" and "Galaxy S24" (same brand) | Single duplicate group returned | P0 | ⬜ |
| DUP-002 | Duplicate detection with minor name difference | "iPhone 15 Pro" and "iPhone 15 Pro " | Grouped, similarity ≥ 0.9 | P1 | ⬜ |
| DUP-003 | Duplicate detection suggests correct survivor | Phone A: 5 images, full specs; Phone B: 1 image, no specs | SuggestedSurvivor = Phone A | P0 | ⬜ |
| DUP-004 | Merge transfers images from target to survivor | Survivor has 2 images, target has 3 | Survivor ends up with 5 images | P0 | ⬜ |
| DUP-005 | Merge transfers prices from target to survivor | Target has 3 PriceTracker entries | All 3 reassigned to survivor | P0 | ⬜ |
| DUP-006 | Merge fills missing specs (IF_MISSING strategy) | Survivor missing RAM, target has RAM | Survivor gets RAM from target | P1 | ⬜ |
| DUP-007 | Merge preserves survivor specs (IF_MISSING strategy) | Both have RAM values | Survivor RAM unchanged | P1 | ⬜ |
| DUP-008 | Merge soft-deletes target phone | Valid merge | Target phone `deletedAt` set, not hard-deleted | P0 | ⬜ |
| DUP-009 | Merge resolves related duplicate issues | 2 issues from PHONE_DUPLICATE_SUSPECT for this group | Both issues set to RESOLVED | P0 | ⬜ |
| DUP-010 | Merge rejects data loss scenario | Target has 12 prices, survivor has 0, transferAssets.prices false | Returns 422 MERGE_VALIDATION_FAILED | P0 | ⬜ |
| DUP-011 | Duplicate list filtered by brand | 3 duplicate groups across 3 brands, filter brandId | Only 1 group returned | P1 | ⬜ |
| DUP-012 | Duplicate list filtered by confidence | Groups with similarity 0.6, 0.7, 0.9; filter minConfidence 0.8 | Only 0.9 group returned | P2 | ⬜ |

---

## 5. Auth Tests

Tests for permission enforcement across roles.

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| AUTH-001 | Superadmin can access all endpoints | Authenticated superadmin | All endpoints return 200/201 | P0 | ⬜ |
| AUTH-002 | Admin can access all endpoints | Authenticated admin | All endpoints return 200/201 | P0 | ⬜ |
| AUTH-003 | Editor can read, scan, fix but not delete | Authenticated editor | Read/scan/fix: 200; delete: 403 | P0 | ⬜ |
| AUTH-004 | Reviewer can only read | Authenticated reviewer | GET: 200; POST: 403 | P0 | ⬜ |
| AUTH-005 | Unauthenticated user rejected | No session/JWT | All endpoints return 401 | P0 | ⬜ |
| AUTH-006 | Expired token rejected | Expired JWT | Returns 401 | P0 | ⬜ |
| AUTH-007 | Reviewer cannot start a scan | Reviewer POST /scans | Returns 403 FORBIDDEN | P0 | ⬜ |
| AUTH-008 | Reviewer cannot fix an issue | Reviewer POST /issues/:id/fix | Returns 403 FORBIDDEN | P0 | ⬜ |
| AUTH-009 | Reviewer cannot merge duplicates | Reviewer POST /duplicates/:id/merge | Returns 403 FORBIDDEN | P0 | ⬜ |
| AUTH-010 | Editor cannot delete issues | Editor on delete endpoint | Returns 403 FORBIDDEN | P1 | ⬜ |
| AUTH-011 | CSV export accessible to reviewer | Reviewer GET /export.csv | Returns 200 with CSV | P1 | ⬜ |
| AUTH-012 | Summary accessible to all authenticated roles | Any role GET /summary | Returns 200 | P0 | ⬜ |

---

## 6. Integration Tests

End-to-end tests verifying the full system workflow.

| Test ID | Description | Preconditions | Expected Result | Priority | Status |
|---------|-------------|---------------|-----------------|----------|--------|
| INT-001 | Full workflow: scan → detect → fix → verify | Phone with null slug; start full scan | Scan detects, fix resolves, re-scan shows 0 issues for this phone | P0 | ⬜ |
| INT-002 | Import → scan → issues found → review | Import batch with 5 bad phones; run import scan | 5+ issues found, all linked to importId | P0 | ⬜ |
| INT-003 | Health score reflects issue resolution | 10 open issues lowering score to 60 | Resolve 5 issues, score increases | P0 | ⬜ |
| INT-004 | Health score excludes ignored issues | 5 open + 3 ignored issues | Score calculated from 5 open only | P0 | ⬜ |
| INT-005 | CSV export contains all open issues | 50 open issues | CSV has 50 data rows + header | P1 | ⬜ |
| INT-006 | CSV export with filters | 50 open, 20 HIGH severity | Filtered CSV has 20 rows | P1 | ⬜ |
| INT-007 | Stale issue auto-resolution on re-scan | Issue OPEN for a field now corrected | Re-scan marks it RESOLVED | P0 | ⬜ |
| INT-008 | Bulk fix mixed issue types | 2 slug + 1 name + 1 whitespace issues | 3 fixed (slug + whitespace), 1 failed (name) | P0 | ⬜ |
| INT-009 | Duplicate merge end-to-end | 2 duplicate phones with different assets | Merge succeeds, survivor has combined assets | P0 | ⬜ |
| INT-010 | Scan progress polling | Start full scan on 500 phones | Progress endpoint shows incrementing processed count | P1 | ⬜ |
| INT-011 | UI tab filters map to correct API params | Click "Missing Specs" tab | API called with issueType/specification filters | P1 | ⬜ |
| INT-012 | Incremental scan after single phone edit | Edit one phone's name; run incremental scan | Only the edited phone is scanned | P0 | ⬜ |
| INT-013 | Large dataset performance | 10,000 phones, 5,000 issues | /issues with pagination responds in < 500ms | P1 | ⬜ |
| INT-014 | Concurrent auto-fix conflict prevention | Two users try to fix same issue simultaneously | First succeeds, second gets 409 | P1 | ⬜ |
| INT-015 | Entity-specific scan creates issue with correct entityType | Scan single phone with null name | Created issue has `entityType: "PHONE"` | P0 | ⬜ |

---

## Test Coverage Summary

| Domain | Total | P0 | P1 | P2 | P3 |
|--------|-------|----|----|----|-----|
| Detection | 45 | 22 | 18 | 5 | 0 |
| Scanning | 17 | 9 | 6 | 2 | 0 |
| Fix | 18 | 12 | 5 | 1 | 0 |
| Duplicate | 12 | 7 | 3 | 2 | 0 |
| Auth | 12 | 9 | 2 | 1 | 0 |
| Integration | 15 | 9 | 5 | 1 | 0 |
| **Total** | **119** | **68** | **39** | **12** | **0** |

---

## Test Environment Requirements

| Requirement | Specification |
|-------------|--------------|
| Database | PostgreSQL 15+ with test schema (migrated) |
| Test data | Seed script creating 100 phones, 10 brands, 300 specs, 500 images, 200 prices |
| Test runner | Jest or Vitest with `@prisma/client` |
| API testing | Supertest for route-level tests |
| Auth mocking | Mock session middleware with configurable role |
| Cleanup | Each test suite runs in a transaction that rolls back |

## Seed Data for Testing

The test seed script should include:

| Scenario | Count | Purpose |
|----------|-------|---------|
| Perfect phones (all data complete) | 10 | Verify no false positives |
| Phones missing name | 3 | PHONE_MISSING_NAME detection |
| Phones missing brand | 2 | PHONE_MISSING_BRAND detection |
| Phones with null slug | 5 | PHONE_EMPTY_SLUG detection + fix |
| Phones with whitespace in name | 3 | PHONE_NAME_WHITESPACE detection + fix |
| Phones with no images | 4 | PHONE_NO_IMAGES detection |
| Phones with images but no primary | 3 | PHONE_NO_PRIMARY_IMAGE detection + fix |
| Specs with object values | 4 | SPEC_INVALID_FORMAT detection + fix |
| Specs missing screen size | 5 | SPEC_MISSING_SCREEN_SIZE detection |
| Active phones with no prices | 6 | PRICE_MISSING detection |
| Orphan brands | 2 | BRAND_ORPHAN detection |
| Duplicate phone pairs | 3 | PHONE_DUPLICATE_SUSPECT detection |
| Import with high failure rate | 1 | IMPORT_HIGH_FAILURE_RATE detection |
| Stale prices (> 30 days) | 4 | PRICE_STALE detection |
| Price anomalies | 2 | PRICE_ANOMALY detection |

---

*This document is part of the PhoneDock Data Quality Center documentation set.*