# PhoneDock Data Quality Rules Catalog

> **Version:** 1.0.0  
> **Last Updated:** 2025-01  
> **Total Rules:** 23

---

## Overview

This document catalogs every rule in the Data Quality Center rules engine. Each rule entry includes:

| Field | Description |
|-------|-------------|
| **Rule ID** | Unique identifier used in `issueKey` and `source` fields |
| **Description** | What the rule checks for |
| **Entity Type** | Which Prisma model the rule scans |
| **Severity** | Default severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| **What It Detects** | Detailed explanation of the detection logic |
| **Confidence** | Detection certainty (0.0–1.0) |
| **Auto-Fix Allowed** | Whether the safe auto-fix pipeline can resolve this |
| **Auto-Fix Description** | What the auto-fix does (if applicable) |
| **Affected Health Category** | Which health score category this contributes to |

---

## Domain 1: Phone Core Data

Rules that validate fundamental phone identity fields.

### RULE-001: `PHONE_MISSING_NAME`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_MISSING_NAME` |
| **Description** | Phone record has no name or empty name |
| **Entity Type** | `PHONE` |
| **Severity** | `CRITICAL` |
| **What It Detects** | Any `Phone` record where `name` is `null`, `undefined`, or a whitespace-only string. A phone without a name cannot be displayed in the catalog or searched. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Name cannot be inferred from other fields |
| **Health Category** | Core Identity (20pts) |

---

### RULE-002: `PHONE_MISSING_BRAND`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_MISSING_BRAND` |
| **Description** | Phone record has no associated brand |
| **Entity Type** | `PHONE` |
| **Severity** | `HIGH` |
| **What It Detects** | Any `Phone` record where `brandId` is `null` or references a non-existent brand. The phone appears uncategorized in brand-filtered views. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Brand assignment requires domain knowledge |
| **Health Category** | Core Identity (20pts) |

---

### RULE-003: `PHONE_EMPTY_SLUG`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_EMPTY_SLUG` |
| **Description** | Phone record has no URL slug |
| **Entity Type** | `PHONE` |
| **Severity** | `HIGH` |
| **What It Detects** | Any `Phone` record where `slug` is `null`, empty, or doesn't match the expected URL-safe pattern (`/^[a-z0-9]+(-[a-z0-9]+)*$/`). Affects URL routing and SEO. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ✅ Yes |
| **Auto-Fix Description** | Generates slug from `name` using slugify algorithm (lowercase, hyphens, strip special chars). E.g., `"Samsung Galaxy S24 Ultra"` → `"samsung-galaxy-s24-ultra"`. Verifies uniqueness before applying. |
| **Health Category** | Core Identity (20pts) |

---

### RULE-004: `PHONE_INVALID_STATUS`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_INVALID_STATUS` |
| **Description** | Phone record has an invalid or unexpected status value |
| **Entity Type** | `PHONE` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `Phone` record where `status` is not one of the expected enum values (`ACTIVE`, `DRAFT`, `DISCONTINUED`, `UPCOMING`). Could indicate a data migration error or schema mismatch. |
| **Confidence** | 0.95 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Status changes affect catalog visibility |
| **Health Category** | Core Identity (20pts) |

---

### RULE-005: `PHONE_NAME_WHITESPACE`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_NAME_WHITESPACE` |
| **Description** | Phone name has leading/trailing whitespace or excessive internal spaces |
| **Entity Type** | `PHONE` |
| **Severity** | `LOW` |
| **What It Detects** | Names with leading/trailing whitespace, multiple consecutive spaces, or tabs/newlines embedded in the string. E.g., `"  iPhone 15  Pro "` or `"Galaxy\tS24"`. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ✅ Yes |
| **Auto-Fix Description** | Trims leading/trailing whitespace and collapses internal whitespace to single spaces. Preserves intentional casing. |
| **Health Category** | Core Identity (20pts) |

---

## Domain 2: Specifications

Rules that validate phone specification completeness and format.

### RULE-006: `SPEC_MISSING_SCREEN_SIZE`

| Field | Value |
|-------|-------|
| **Rule ID** | `SPEC_MISSING_SCREEN_SIZE` |
| **Description** | Phone has no screen size specification |
| **Entity Type** | `PHONE_SPECIFICATION` |
| **Severity** | `HIGH` |
| **What It Detects** | Any `PhoneSpecification` record where `screenSize` is `null` or empty. Screen size is one of the most frequently searched spec fields. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Cannot be inferred from other specs |
| **Health Category** | Specifications (25pts) |

---

### RULE-007: `SPEC_MISSING_RAM`

| Field | Value |
|-------|-------|
| **Rule ID** | `SPEC_MISSING_RAM` |
| **Description** | Phone has no RAM specification |
| **Entity Type** | `PHONE_SPECIFICATION` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `PhoneSpecification` where `ram` is `null` or empty. RAM is important for comparison and filtering but some very old/obscure devices may legitimately lack this data. |
| **Confidence** | 0.9 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | RAM varies by variant; cannot be assumed |
| **Health Category** | Specifications (25pts) |

---

### RULE-008: `SPEC_MISSING_STORAGE`

| Field | Value |
|-------|-------|
| **Rule ID** | `SPEC_MISSING_STORAGE` |
| **Description** | Phone has no storage specification |
| **Entity Type** | `PHONE_SPECIFICATION` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `PhoneSpecification` where `storage` is `null` or empty. Affects product comparison and filter functionality. |
| **Confidence** | 0.9 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Storage varies by variant |
| **Health Category** | Specifications (25pts) |

---

### RULE-009: `SPEC_INVALID_FORMAT`

| Field | Value |
|-------|-------|
| **Rule ID** | `SPEC_INVALID_FORMAT` |
| **Description** | Specification field contains an object where a string is expected, or has an unexpected data type |
| **Entity Type** | `PHONE_SPECIFICATION` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Fields like `processor`, `gpu`, `os`, `battery` that contain JSON objects or arrays instead of string values. Common after data imports that don't flatten nested structures. E.g., `{value: "A17 Pro"}` instead of `"A17 Pro"`. |
| **Confidence** | 0.95 |
| **Auto-Fix Allowed** | ✅ Yes |
| **Auto-Fix Description** | If the value is an object with a `value`, `name`, `text`, or `label` key, extracts the string. If it's an array with one element, extracts that element. Otherwise, converts to JSON string. |
| **Health Category** | Specifications (25pts) |

---

## Domain 3: Images

Rules that validate phone image coverage and integrity.

### RULE-010: `PHONE_NO_IMAGES`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_NO_IMAGES` |
| **Description** | Phone has zero associated images |
| **Entity Type** | `PHONE` |
| **Severity** | `HIGH` |
| **What It Detects** | Any `Phone` with no records in `PhoneImage`. Phones without images cannot be properly displayed in the catalog and have significantly lower engagement. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Cannot generate images |
| **Health Category** | Images (15pts) |

---

### RULE-011: `PHONE_NO_PRIMARY_IMAGE`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_NO_PRIMARY_IMAGE` |
| **Description** | Phone has images but none is marked as primary |
| **Entity Type** | `PHONE` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `Phone` that has at least one `PhoneImage` record but none has `isPrimary: true`. The catalog display falls back to the first image or a placeholder. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ✅ Yes |
| **Auto-Fix Description** | Sets the first `PhoneImage` (ordered by `createdAt` ASC) as primary (`isPrimary: true`). Before doing so, verifies the image URL is non-empty and the image record is not soft-deleted. |
| **Health Category** | Images (15pts) |

---

### RULE-012: `PHONE_IMAGE_BROKEN_URL`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_IMAGE_BROKEN_URL` |
| **Description** | Phone image has an empty, null, or malformed URL |
| **Entity Type** | `PHONE_IMAGE` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `PhoneImage` where `url` is `null`, empty string, or doesn't match a valid URL pattern. Does NOT perform HTTP HEAD requests (that would be an async validation job). |
| **Confidence** | 0.85 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Cannot determine the correct URL |
| **Health Category** | Images (15pts) |

---

## Domain 4: Benchmarks

Rules that validate benchmark data availability and recency.

### RULE-013: `BENCHMARK_MISSING_DATA`

| Field | Value |
|-------|-------|
| **Rule ID** | `BENCHMARK_MISSING_DATA` |
| **Description** | Phone has no benchmark scores recorded |
| **Entity Type** | `PHONE_BENCHMARK` |
| **Severity** | `LOW` |
| **What It Detects** | Any active phone (`status: ACTIVE`) that has no `PhoneBenchmark` record or where all benchmark score fields (`antutu`, `geekbenchSingle`, `geekbenchMulti`, `dimensity`) are null. |
| **Confidence** | 0.8 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Benchmark data must be measured, not inferred |
| **Health Category** | Verification (5pts) |

---

### RULE-014: `BENCHMARK_STALE_DATA`

| Field | Value |
|-------|-------|
| **Rule ID** | `BENCHMARK_STALE_DATA` |
| **Description** | Benchmark data is older than 365 days |
| **Entity Type** | `PHONE_BENCHMARK` |
| **Severity** | `LOW` |
| **What It Detects** | Any `PhoneBenchmark` where `createdAt` is more than 365 days ago. Stale benchmarks may not reflect current software optimizations. Only applies to `ACTIVE` phones. |
| **Confidence** | 0.7 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Requires re-running benchmarks, not a data fix |
| **Health Category** | Verification (5pts) |

---

## Domain 5: Brands

Rules that validate brand data and relationships.

### RULE-015: `BRAND_ORPHAN`

| Field | Value |
|-------|-------|
| **Rule ID** | `BRAND_ORPHAN` |
| **Description** | Brand exists but has zero phones associated with it |
| **Entity Type** | `BRAND` |
| **Severity** | `LOW` |
| **What It Detects** | Any `Brand` record where no `Phone` references it via `brandId`. Could indicate a deleted phone batch without brand cleanup, or a pre-populated brand that was never used. |
| **Confidence** | 0.8 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Brand deletion may be intentional (upcoming products) |
| **Health Category** | Relationships (10pts) |

---

### RULE-016: `BRAND_MISSING_LOGO`

| Field | Value |
|-------|-------|
| **Rule ID** | `BRAND_MISSING_LOGO` |
| **Description** | Brand has no logo image |
| **Entity Type** | `BRAND` |
| **Severity** | `LOW` |
| **What It Detects** | Any `Brand` that has at least one associated phone but has no `logoUrl` or the `logoUrl` is empty/null. |
| **Confidence** | 0.9 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Logo assets must be sourced manually |
| **Health Category** | Relationships (10pts) |

---

## Domain 6: Price Tracker

Rules that validate pricing data completeness and freshness.

### RULE-017: `PRICE_MISSING`

| Field | Value |
|-------|-------|
| **Rule ID** | `PRICE_MISSING` |
| **Description** | Active phone has no price tracker entries |
| **Entity Type** | `PHONE` |
| **Severity** | `HIGH` |
| **What It Detects** | Any `ACTIVE` phone with no `PriceTracker` records. Users cannot see pricing information, which is a critical catalog feature. |
| **Confidence** | 1.0 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Prices must come from external sources |
| **Health Category** | Prices (15pts) |

---

### RULE-018: `PRICE_STALE`

| Field | Value |
|-------|-------|
| **Rule ID** | `PRICE_STALE` |
| **Description** | Price data is older than 30 days |
| **Entity Type** | `PRICE_TRACKER` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `PriceTracker` record for an `ACTIVE` phone where the price was last updated more than 30 days ago. Stale prices may mislead users about current market value. |
| **Confidence** | 0.85 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Price updates require external data fetch |
| **Health Category** | Prices (15pts) |

---

### RULE-019: `PRICE_ANOMALY`

| Field | Value |
|-------|-------|
| **Rule ID** | `PRICE_ANOMALY` |
| **Description** | Price deviates significantly from the phone's category average |
| **Entity Type** | `PRICE_TRACKER` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any `PriceTracker` where the price is more than 3 standard deviations from the mean price of phones in the same brand tier and screen-size category. Uses statistical outlier detection (z-score > 3). |
| **Confidence** | 0.6 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Anomalous prices may be legitimate (flagship vs budget) |
| **Health Category** | Prices (15pts) |

---

## Domain 7: Imports

Rules that detect problems related to data import batches.

### RULE-020: `IMPORT_HIGH_FAILURE_RATE`

| Field | Value |
|-------|-------|
| **Rule ID** | `IMPORT_HIGH_FAILURE_RATE` |
| **Description** | Import batch has a failure rate exceeding 25% |
| **Entity Type** | `IMPORT` |
| **Severity** | `HIGH` |
| **What It Detects** | Any import batch where `(failedRows / totalRows) > 0.25`. Indicates a systematic problem with the import source (format mismatch, encoding issues, schema changes). |
| **Confidence** | 0.95 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Import issues require source data correction |
| **Health Category** | — (Import-specific) |

---

### RULE-021: `IMPORT_PARTIAL`

| Field | Value |
|-------|-------|
| **Rule ID** | `IMPORT_PARTIAL` |
| **Description** | Import batch was started but never completed |
| **Entity Type** | `IMPORT` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Any import with `status` stuck in `RUNNING` or `PROCESSING` for more than 24 hours, or where `processedRows < totalRows` and `status` is not `COMPLETED`. |
| **Confidence** | 0.9 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Requires investigation of the import process |
| **Health Category** | — (Import-specific) |

---

### RULE-022: `IMPORT_STALE_PENDING`

| Field | Value |
|-------|-------|
| **Rule ID** | `IMPORT_STALE_PENDING` |
| **Description** | Import has been in PENDING status for more than 1 hour |
| **Entity Type** | `IMPORT` |
| **Severity** | `LOW` |
| **What It Detects** | Any import with `status: PENDING` where `createdAt` is more than 1 hour ago. May indicate a queue processing issue. |
| **Confidence** | 0.7 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | May be intentional (scheduled import) |
| **Health Category** | — (Import-specific) |

---

### RULE-023: `PHONE_DUPLICATE_SUSPECT`

| Field | Value |
|-------|-------|
| **Rule ID** | `PHONE_DUPLICATE_SUSPECT` |
| **Description** | Potential duplicate phone detected by name/brand similarity |
| **Entity Type** | `PHONE` |
| **Severity** | `MEDIUM` |
| **What It Detects** | Pairs of phones that share the same brand and have names with Levenshtein distance ≤ 2 or normalized name match (lowercased, punctuation-stripped). Also checks for same `releaseYear` and overlapping `storage` specifications to reduce false positives. Groups are formed transitively (A≈B, B≈C → {A,B,C}). |
| **Confidence** | 0.6 |
| **Auto-Fix Allowed** | ❌ No |
| **Reason** | Duplicate merging requires human judgment |
| **Health Category** | Duplicates (10pts) |

---

## Summary Table

| # | Rule ID | Entity Type | Severity | Confidence | Auto-Fix | Health Category |
|---|---------|-------------|----------|------------|----------|-----------------|
| 1 | `PHONE_MISSING_NAME` | PHONE | CRITICAL | 1.0 | ❌ | Core Identity |
| 2 | `PHONE_MISSING_BRAND` | PHONE | HIGH | 1.0 | ❌ | Core Identity |
| 3 | `PHONE_EMPTY_SLUG` | PHONE | HIGH | 1.0 | ✅ | Core Identity |
| 4 | `PHONE_INVALID_STATUS` | PHONE | MEDIUM | 0.95 | ❌ | Core Identity |
| 5 | `PHONE_NAME_WHITESPACE` | PHONE | LOW | 1.0 | ✅ | Core Identity |
| 6 | `SPEC_MISSING_SCREEN_SIZE` | PHONE_SPECIFICATION | HIGH | 1.0 | ❌ | Specifications |
| 7 | `SPEC_MISSING_RAM` | PHONE_SPECIFICATION | MEDIUM | 0.9 | ❌ | Specifications |
| 8 | `SPEC_MISSING_STORAGE` | PHONE_SPECIFICATION | MEDIUM | 0.9 | ❌ | Specifications |
| 9 | `SPEC_INVALID_FORMAT` | PHONE_SPECIFICATION | MEDIUM | 0.95 | ✅ | Specifications |
| 10 | `PHONE_NO_IMAGES` | PHONE | HIGH | 1.0 | ❌ | Images |
| 11 | `PHONE_NO_PRIMARY_IMAGE` | PHONE | MEDIUM | 1.0 | ✅ | Images |
| 12 | `PHONE_IMAGE_BROKEN_URL` | PHONE_IMAGE | MEDIUM | 0.85 | ❌ | Images |
| 13 | `BENCHMARK_MISSING_DATA` | PHONE_BENCHMARK | LOW | 0.8 | ❌ | Verification |
| 14 | `BENCHMARK_STALE_DATA` | PHONE_BENCHMARK | LOW | 0.7 | ❌ | Verification |
| 15 | `BRAND_ORPHAN` | BRAND | LOW | 0.8 | ❌ | Relationships |
| 16 | `BRAND_MISSING_LOGO` | BRAND | LOW | 0.9 | ❌ | Relationships |
| 17 | `PRICE_MISSING` | PHONE | HIGH | 1.0 | ❌ | Prices |
| 18 | `PRICE_STALE` | PRICE_TRACKER | MEDIUM | 0.85 | ❌ | Prices |
| 19 | `PRICE_ANOMALY` | PRICE_TRACKER | MEDIUM | 0.6 | ❌ | Prices |
| 20 | `IMPORT_HIGH_FAILURE_RATE` | IMPORT | HIGH | 0.95 | ❌ | — |
| 21 | `IMPORT_PARTIAL` | IMPORT | MEDIUM | 0.9 | ❌ | — |
| 22 | `IMPORT_STALE_PENDING` | IMPORT | LOW | 0.7 | ❌ | — |
| 23 | `PHONE_DUPLICATE_SUSPECT` | PHONE | MEDIUM | 0.6 | ❌ | Duplicates |

---

## Auto-Fix Eligible Rules

Only 4 of 23 rules are auto-fixable. This is by design — the system prioritizes data safety over automation.

| Rule ID | What Gets Fixed | Risk Level |
|---------|----------------|------------|
| `PHONE_EMPTY_SLUG` | Generates URL-safe slug from name | Very Low — generated value is deterministic |
| `PHONE_NAME_WHITESPACE` | Trims and normalizes whitespace | Very Low — purely cosmetic |
| `PHONE_NO_PRIMARY_IMAGE` | Promotes first image to primary | Low — reversible, no data loss |
| `SPEC_INVALID_FORMAT` | Extracts string from nested object | Low — original value preserved in issue metadata |

---

## Rule Extension Guide

To add a new rule:

1. Create a rule definition object implementing the `Rule` interface
2. Assign a unique `ruleId` following the `{DOMAIN}_{DESCRIPTOR}` pattern
3. Set `entityType` to the Prisma model being scanned
4. Choose severity based on impact (see severity guidelines below)
5. Implement `detect(entity)` — return `null` if no issue, or an `Issue` object
6. Optionally implement `fix(entity)` if the fix is safe and deterministic
7. Register the rule in the rules registry

### Severity Guidelines

| Severity | Criteria | Example |
|----------|----------|---------|
| `CRITICAL` | Data is completely missing; entity is non-functional | No name, no brand |
| `HIGH` | Major feature broken; significant user impact | No images, no prices |
| `MEDIUM` | Degraded experience; workaround exists | No primary image, stale price |
| `LOW` | Minor cosmetic or informational issue | Whitespace, missing logo |

---

*This document is part of the PhoneDock Data Quality Center documentation set.*