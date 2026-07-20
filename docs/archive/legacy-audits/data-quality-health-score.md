# PhoneDock Data Quality Health Score

> Documentation of the weighted health score system used in the Data Quality Center dashboard.
> The health score provides a single 0–100 number representing overall data quality.

---

## Overview

The health score is calculated on-demand by the `calculateHealthScore()` function in `src/lib/data-quality/scanner.ts`. It runs 7 independent category assessments, each contributing a weighted score that sums to 100. Deductions within each category are proportional to the number of affected phones relative to the published phone count.

**Formula:**

```
Health Score = Σ (category.weight − category.deduction)

where 0 ≤ category.score ≤ category.weight
and   0 ≤ Health Score ≤ 100
```

---

## The 7 Categories

| #  | Category       | Weight | Max Deduction | Description                                   |
|----|----------------|--------|---------------|-----------------------------------------------|
| 1  | Core Identity  | 20     | 20            | Phone, brand, slug, status completeness       |
| 2  | Specifications | 25     | 25            | PhoneSpecs document and key fields            |
| 3  | Images         | 15     | 15            | Phone images and primary image                |
| 4  | Prices         | 15     | 15            | Price validity and freshness                  |
| 5  | Relationships  | 10     | 10            | Orphan records and broken references          |
| 6  | Duplicates     | 10     | 10            | Duplicate phones and brands                   |
| 7  | Verification   | 5      | 5             | Data confidence and verification status       |
|    | **Total**      | **100**| **100**       |                                               |

---

## Category Details

### 1. Core Identity (Weight: 20, Max Deduction: 20)

Measures whether published phones have their fundamental identity fields populated.

**Metrics checked:**

| Metric            | Query                                                           | Deduction Factor |
|-------------------|-----------------------------------------------------------------|------------------|
| Missing brand     | Published phones with null/missing `brandId`                   | 8 / base          |
| Missing slug      | Published phones with empty/null `slug`                        | 6 / base          |
| Missing model     | Published phones with empty/null `modelName`                   | 6 / base          |
| Missing PTA status| Published phones with `ptaStatus` = null/empty/`Unknown`        | (tracked, not deducted) |

**Calculation:**

```
deduction = min(20, (missingBrand / base × 8) + (missingSlug / base × 6) + (missingModel / base × 6))
score     = max(0, 20 − deduction)
```

**Example:** 1,000 published phones, 5 missing brand, 2 missing slug, 0 missing model:
```
deduction = min(20, (5/1000 × 8) + (2/1000 × 6) + 0) = 0.052
score     = 20 − 0.052 = 19.948
```

---

### 2. Specifications (Weight: 25, Max Deduction: 25)

Measures the completeness of phone specification data.

**Metrics checked:**

| Metric          | Query                                                             | Deduction Factor |
|-----------------|-------------------------------------------------------------------|------------------|
| Missing specs   | Published phones without any `PhoneSpecs` document                | 15 / base        |
| Empty specs     | `PhoneSpecs` where all 5 key fields are empty                      | 10 / base        |

Key fields: `chipset`, `ram`, `storage`, `display`, `battery`.

**Calculation:**

```
deduction = min(25, (missingSpecs / base × 15) + (emptySpecs / base × 10))
score     = max(0, 25 − deduction)
```

**Example:** 1,000 published phones, 60 missing specs, 20 empty specs:
```
deduction = min(25, (60/1000 × 15) + (20/1000 × 10)) = 0.9 + 0.2 = 1.1
score     = 25 − 1.1 = 23.9
```

---

### 3. Images (Weight: 15, Max Deduction: 15)

Measures whether phones have visual content.

**Metrics checked:**

| Metric               | Query                                                            | Deduction Factor |
|----------------------|------------------------------------------------------------------|------------------|
| Missing thumbnail    | Published phones with empty/null `thumbnail`                     | —                |
| No images at all     | Published phones with no `PhoneImage` records                    | —                |
| Image issues         | `max(phonesWithoutThumb, phonesNoImg)`                           | 15 / base        |

Uses `PhoneImage.distinct('phoneId')` to count phones that have at least one image.

**Calculation:**

```
imgIssues = max(phonesWithoutThumbnail, phonesWithNoImages)
deduction = min(15, imgIssues / base × 15)
score     = max(0, 15 − deduction)
```

---

### 4. Prices (Weight: 15, Max Deduction: 15)

Measures price data validity and freshness.

**Metrics checked:**

| Metric        | Query                                                           | Deduction Factor |
|---------------|-----------------------------------------------------------------|------------------|
| No price      | Published phones with `pricePKR` ≤ 0, null, or negative         | 10 / base        |
| Stale price   | Published phones with `lastPriceCheckedAt` null or >30 days ago | 5 / base         |

**Calculation:**

```
deduction = min(15, (noPrice / base × 10) + (stalePrices / base × 5))
score     = max(0, 15 − deduction)
```

---

### 5. Relationships (Weight: 10, Max Deduction: 10)

Measures referential integrity between collections.

**Metrics checked:**

| Metric          | Query                                                                                |
|-----------------|--------------------------------------------------------------------------------------|
| Orphan records  | Open `DataQualityIssue` documents with issue types: `ORPHAN_SPECS`, `ORPHAN_IMAGE`, `ORPHAN_PRICE`, `ORPHAN_BENCHMARK` |

This category queries the issue tracker rather than scanning directly, so it reflects the last scan's findings.

**Calculation:**

```
deduction = min(10, openOrphanIssues / base × 10)
score     = max(0, 10 − deduction)
```

---

### 6. Duplicates (Weight: 10, Max Deduction: 10)

Measures duplicate data across the system.

**Metrics checked:**

| Metric             | Query                                                                                          |
|--------------------|------------------------------------------------------------------------------------------------|
| Duplicate candidates | Open `DataQualityIssue` documents with types: `PHONE_DUPLICATE_SLUG`, `PHONE_DUPLICATE_NORMALIZED`, `BRAND_DUPLICATE_NORMALIZED`, `SPECS_DUPLICATE` |

**Calculation:**

```
deduction = min(10, openDupIssues / base × 10)
score     = max(0, 10 − deduction)
```

---

### 7. Verification (Weight: 5, Max Deduction: 5)

Measures data confidence levels across the phone catalog.

**Metrics checked:**

| Metric          | Query                                                              |
|-----------------|--------------------------------------------------------------------|
| Unverified      | Published phones where `dataConfidence` is not `'verified'`        |

**Calculation:**

```
deduction = min(5, unverified / base × 5)
score     = max(0, 5 − deduction)
```

---

## Full Score Composition

The final health score is:

```
Health Score = round(
  CoreIdentity.score +
  Specifications.score +
  Images.score +
  Prices.score +
  Relationships.score +
  Duplicates.score +
  Verification.score
)
```

Clamped to `[0, 100]`.

---

## Score Interpretation Guide

| Range    | Rating     | Action                                                        |
|----------|------------|---------------------------------------------------------------|
| 90–100   | Excellent  | Routine monitoring only                                       |
| 75–89    | Good       | Address medium-severity gaps                                  |
| 60–74    | Fair       | Active improvement needed; review top deductions              |
| 40–59    | Poor       | Significant data gaps; prioritize high-deduction categories   |
| 0–39     | Critical   | Systemic quality problems; require immediate attention        |

---

## API Integration

The health score is computed and returned by:

- **GET `/api/admin/data-quality/summary`** — included in the `health` field (opt-out via `?health=false`)
- **GET `/api/admin/data-quality/summary?health=false`** — skips health calculation for faster response

Each category in the response includes `name`, `score`, `deduction`, `maxDeduction`, and `details` (human-readable summary of what's affecting the score).

**Response structure:**

```json
{
  "score": 82,
  "categories": [
    {
      "name": "Core Identity",
      "score": 19.5,
      "deduction": 0.5,
      "maxDeduction": 20,
      "details": "5 missing brand, 2 missing slug"
    }
  ],
  "totals": {
    "totalPhones": 1250,
    "publishedPhones": 1000,
    "draftPhones": 250
  }
}
```

---

## Performance Notes

- The health score executes **7 database queries** (one per category) plus the 3 base count queries.
- The `base` divisor is `publishedPhones` (or `1` if zero) to prevent division by zero.
- Each category's deduction is independently clamped to its `maxDeduction`, preventing a single category from deducting more than its weight.
- The Relationships and Duplicates categories query the `DataQualityIssue` collection rather than scanning collections directly, making them dependent on the last scan being reasonably current.

---

*Source: `src/lib/data-quality/types.ts` (HEALTH_CATEGORIES), `src/lib/data-quality/scanner.ts` (calculateHealthScore)*