# PhoneDock Data Quality Rules Catalog

> Complete reference for all 32 quality detection rules in the PhoneDock Data Quality Center.
> Rules are organized by functional category. Each entry documents the rule identifier, behavior,
> severity level, target entity type, and auto-fix capability.

---

## Rule Severity Scale

| Level     | Meaning                                                          |
|-----------|------------------------------------------------------------------|
| `critical` | Data corruption or broken references that block core features   |
| `high`     | Significant missing data or integrity problems                  |
| `medium`   | Incomplete data that degrades user experience                   |
| `low`      | Minor gaps or best-practice violations                          |
| `info`     | Suggestions for improvement, not errors                         |

---

## 1. Phone Core Data (8 rules)

Rules that validate the Phone document itself — identity fields, pricing, dates, and basic completeness.

### PHONE_MISSING_SPECS

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_MISSING_SPECS`                                      |
| **title**    | Missing PhoneSpecs Document                                |
| **severity** | `high`                                                     |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone has no associated PhoneSpecs document.

**Detection logic:** Iterates over all phones in the batch and checks the `specs` lookup map. If no `PhoneSpecs` document is keyed to the phone's `_id`, an issue is raised.

**Suggested value:** `Create PhoneSpecs document`

---

### PHONE_DUPLICATE_SLUG

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_DUPLICATE_SLUG`                                     |
| **title**    | Duplicate Slug                                             |
| **severity** | `critical`                                                 |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Multiple phones share the same slug (should be unique).

**Detection logic:** Builds a count map of all slugs across the batch. Any slug appearing more than once generates an issue for every phone sharing it. Metadata includes the full list of duplicate IDs.

**Suggested value:** Manual review required — slugs must be unique for URL routing.

---

### PHONE_INVALID_PRICE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_INVALID_PRICE`                                      |
| **title**    | Invalid Price                                              |
| **severity** | `high` (escalates to `critical` for negative prices)       |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone has a negative, zero, or extreme outlier price.

**Detection logic:** Calculates the median `pricePKR` across all phones, then checks each phone for:
- **Negative price** — severity `critical`, confidence `1.0`
- **Zero price on published phone** — severity `medium`, confidence `0.8`
- **Outlier (>10x median)** — severity `high`, confidence `0.6`; metadata includes median and upper bound

---

### PHONE_MISSING_PRIMARY_IMAGE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_MISSING_PRIMARY_IMAGE`                              |
| **title**    | Missing Primary Image                                      |
| **severity** | `medium`                                                   |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no thumbnail or images.

**Detection logic:** For published phones only, checks both `phone.thumbnail` (empty/null) and the images lookup map (empty array). Both must be missing to trigger.

---

### PHONE_MISSING_PRICE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_MISSING_PRICE`                                      |
| **title**    | Missing Price                                              |
| **severity** | `high`                                                     |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no price set.

**Detection logic:** Published phones with `pricePKR` that is null, undefined, or <= 0 are flagged. Confidence is `1.0`.

---

### PHONE_STALE_PRICE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_STALE_PRICE`                                        |
| **title**    | Stale Price                                                |
| **severity** | `low`                                                      |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone price has not been checked in over 30 days.

**Detection logic:** For published phones, checks `lastPriceCheckedAt`. If null or older than 30 days, an issue is raised with confidence `0.9`.

---

### PHONE_INVALID_RELEASE_DATE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_INVALID_RELEASE_DATE`                               |
| **title**    | Invalid Release Date                                       |
| **severity** | `medium` (escalates to `high` for malformed dates)         |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone has a future date beyond sensible range or malformed date.

**Detection logic:**
- **Malformed date** (`NaN` from `new Date()`) — severity `high`, confidence `1.0`
- **Future date >3 years** — severity `medium`, confidence `0.7`

---

### PHONE_MISSING_PTA_STATUS

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_MISSING_PTA_STATUS`                                 |
| **title**    | Missing PTA Status                                         |
| **severity** | `low`                                                      |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no PTA status set.

**Detection logic:** For published phones, flags when `ptaStatus` is null, empty, or `'Unknown'`. Confidence `0.7`.

---

## 2. Specifications (4 rules)

Rules targeting `PhoneSpecs` documents and their relationship to Phone records.

### SPECS_DUPLICATE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `SPECS_DUPLICATE`                                          |
| **title**    | Duplicate PhoneSpecs Documents                             |
| **severity** | `high`                                                     |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `true` (manual review required)                           |

**Description:** Multiple PhoneSpecs documents exist for the same phone.

**Detection logic:** Detected in the scanner's orphan scan phase by counting specs per `phoneId`. The rule definition itself returns an empty array — detection is centralized.

---

### SPECS_EMPTY

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `SPECS_EMPTY`                                              |
| **title**    | Empty PhoneSpecs Document                                  |
| **severity** | `medium`                                                   |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** PhoneSpecs document exists but all key fields are empty.

**Detection logic:** Checks if `chipset`, `ram`, `storage`, `display`, and `battery` are all empty/whitespace. Only phones that actually have a specs document are evaluated.

---

### SPECS_MISSING_KEY_FIELDS

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `SPECS_MISSING_KEY_FIELDS`                                 |
| **title**    | Missing Key Spec Fields                                    |
| **severity** | `low`                                                      |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** PhoneSpecs document is missing important fields like chipset, RAM, storage.

**Detection logic:** Checks five fields (`chipset`, `ram`, `storage`, `display`, `battery`). Each missing field generates a separate issue with severity `low` and confidence `0.9`.

---

### SPECS_OBJECT_IN_STRING

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `SPECS_OBJECT_IN_STRING`                                   |
| **title**    | Object Stored as String in Specs                           |
| **severity** | `high`                                                     |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `true`                                                   |

**Description:** A spec field contains `[object Object]` instead of actual data.

**Detection logic:** Scans 40+ string fields in PhoneSpecs (display, chipset, camera fields, connectivity, etc.) for values where `typeof val === 'object'`. This typically happens when a nested object is assigned directly to a string field.

**Auto-fix behavior:**
- **Dry run:** Returns a preview of what would change.
- **Live:** Finds the PhoneSpecs document by `phoneId`, converts the object to `JSON.stringify()`, and saves. Writes directly to the database.

---

## 3. Images (1 rule)

### IMAGE_MULTIPLE_PRIMARY

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `IMAGE_MULTIPLE_PRIMARY`                                   |
| **title**    | Multiple Primary Images                                    |
| **severity** | `low`                                                      |
| **entityType** | `phone_image`                                            |
| **canAutoFix** | `true`                                                   |

**Description:** Phone has multiple images with the same lowest sortOrder (duplicate primaries).

**Detection logic:** Filters a phone's images for those with `sortOrder === 0`. If more than one exists, an issue is raised with confidence `0.9`.

**Auto-fix behavior:**
- **Dry run:** Returns preview of sequential reassignment.
- **Live:** Fetches all images for the phone sorted by current `sortOrder`, reassigns sequential values (`0, 1, 2, ...`), and writes each updated `sortOrder` to the database via `PhoneImage.updateOne()`.

---

## 4. Benchmarks (1 rule)

### BENCHMARK_IMPOSSIBLE_SCORE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `BENCHMARK_IMPOSSIBLE_SCORE`                               |
| **title**    | Impossible Benchmark Score                                 |
| **severity** | `high`                                                     |
| **entityType** | `phone_benchmark`                                         |
| **canAutoFix** | `false`                                                  |

**Description:** Benchmark has a negative score which is impossible.

**Detection logic:** For phones with benchmarks, checks `antutu`, `geekbenchSingle`, `geekbenchMulti`, and `gamingScore` for negative values. Each negative field generates a separate issue. Confidence `1.0`.

---

## 5. Orphans (4 rules)

Rules detecting child records (specs, images, prices, benchmarks) that reference a phone that no longer exists. All four rules are detected centrally in the scanner's `scanOrphans()` function, not in the rule definitions themselves.

### ORPHAN_SPECS

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `ORPHAN_SPECS`                                             |
| **title**    | Orphan PhoneSpecs                                          |
| **severity** | `high`                                                     |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** PhoneSpecs document references a non-existent phone.

**Detection logic:** Iterates all PhoneSpecs, checks if the referenced `phoneId` exists in the valid phones set. Double-checks against the database for phones not in the current batch.

---

### ORPHAN_IMAGE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `ORPHAN_IMAGE`                                             |
| **title**    | Orphan PhoneImage                                          |
| **severity** | `medium`                                                   |
| **entityType** | `phone_image`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** PhoneImage references a non-existent phone.

---

### ORPHAN_PRICE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `ORPHAN_PRICE`                                             |
| **title**    | Orphan PhonePrice                                          |
| **severity** | `medium`                                                   |
| **entityType** | `phone_price`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** PhonePrice references a non-existent phone. Issue key includes the store name for disambiguation.

---

### ORPHAN_BENCHMARK

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `ORPHAN_BENCHMARK`                                         |
| **title**    | Orphan PhoneBenchmark                                      |
| **severity** | `medium`                                                   |
| **entityType** | `phone_benchmark`                                         |
| **canAutoFix** | `false`                                                  |

**Description:** PhoneBenchmark references a non-existent phone.

---

## 6. Brand (2 rules)

### BRAND_DUPLICATE_NORMALIZED

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `BRAND_DUPLICATE_NORMALIZED`                               |
| **title**    | Duplicate Brand Name                                       |
| **severity** | `high`                                                     |
| **entityType** | `brand`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Two brands have the same normalized name (case-insensitive).

**Detection logic:** Normalizes each brand name to lowercase with non-alphanumeric characters stripped. Groups by normalized name and flags any group with >1 entry. Metadata includes all candidate brand IDs. Confidence `0.7`.

---

### BRAND_MISSING_LOGO

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `BRAND_MISSING_LOGO`                                       |
| **title**    | Brand Missing Logo                                         |
| **severity** | `low`                                                      |
| **entityType** | `brand`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Brand has no logo set.

**Detection logic:** Checks all brands for a falsy `logo` field. Confidence `1.0`.

---

## 7. Price Tracker (4 rules)

Rules integrated with the Price Tracker system. Detection is implemented in `scanPriceTrackerIssues()` in the scanner rather than in the rule `detect()` methods, because they query `PhoneRetailListing` and `PriceSource` collections directly.

### PRICE_STALE_TRACKED

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PRICE_STALE_TRACKED`                                      |
| **title**    | Stale Tracked Price                                        |
| **severity** | `low`                                                      |
| **entityType** | `retail_listing`                                         |
| **canAutoFix** | `false`                                                  |

**Description:** Retail listing price has not been checked in over 14 days.

**Detection logic:** Queries enabled `PhoneRetailListing` documents where `lastCheckedAt` is null or older than 14 days. Metadata includes `phoneId` and `currentSourcePrice`. Confidence `0.9`.

---

### PRICE_SOURCE_INACTIVE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PRICE_SOURCE_INACTIVE`                                    |
| **title**    | Inactive Price Source                                      |
| **severity** | `info`                                                     |
| **entityType** | `price_source`                                           |
| **canAutoFix** | `false`                                                  |

**Description:** A price source that was previously active is now disabled or failed.

**Detection logic:** Finds `PriceSource` documents where `enabled: false && status !== 'active'` or `status: 'failed' && failureCount > 3`. Metadata includes source name, failure count, and enabled status. Confidence `1.0`.

---

### PRICE_OUTLIER

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PRICE_OUTLIER`                                            |
| **title**    | Price Outlier                                              |
| **severity** | `medium`                                                   |
| **entityType** | `retail_listing`                                         |
| **canAutoFix** | `false`                                                  |

**Description:** Retail listing price is significantly different from phone price (>50% deviation).

**Detection logic:** Groups enabled, non-rejected listings by `phoneId`. For each phone with a valid `pricePKR`, calculates `|listingPrice - phonePrice| / phonePrice`. Flags when deviation exceeds 0.5 (50%). Metadata includes phone price and percentage deviation. Confidence `0.7`.

---

### PRICE_MISMATCH

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PRICE_MISMATCH`                                           |
| **title**    | Price Mismatch                                             |
| **severity** | `medium`                                                   |
| **entityType** | `retail_listing`                                         |
| **canAutoFix** | `false`                                                  |

**Description:** Lowest retail listing price is significantly lower than phone price but phone is not updated.

**Detection logic:** Finds in-stock, verified/pending listings. Groups by phone and finds the minimum listing price. Flags phones where `pricePKR` is >10% higher than the lowest listing AND the phone has not been price-updated in the last 30 days (or `manualLock` is not set). Confidence `0.6`.

---

## 8. Import (2 rules)

### IMPORT_FAILED_ROWS

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `IMPORT_FAILED_ROWS`                                       |
| **title**    | Failed Import Rows                                         |
| **severity** | `medium`                                                   |
| **entityType** | `import`                                                 |
| **canAutoFix** | `false`                                                  |

**Description:** Import job had rows that failed to process.

**Detection logic:** Summed from all `ImportBatch.error` arrays for the import job. Only triggered during import-specific scans. The issue's `entityId` is the `importId`.

---

### IMPORT_LOW_CONFIDENCE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `IMPORT_LOW_CONFIDENCE`                                    |
| **title**    | Low-Confidence Imported Data                               |
| **severity** | `info`                                                     |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone was imported with auto-imported data confidence.

**Detection logic:** Checks `dataConfidence === 'auto-imported'` on each phone. When running an import-specific scan, issues are tagged with the `importId` for filtering. Confidence `0.8`.

---

## 9. Additional Rules (5 rules)

### PHONE_EMPTY_DESCRIPTION

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_EMPTY_DESCRIPTION`                                  |
| **title**    | Empty Description                                          |
| **severity** | `low`                                                      |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no description set.

**Detection logic:** For published phones, checks if `description` is null, undefined, or empty/whitespace-only. Confidence `0.9`.

---

### PHONE_MISSING_RELEASE_DATE

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_MISSING_RELEASE_DATE`                               |
| **title**    | Missing Release Date                                       |
| **severity** | `low`                                                      |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no release date.

**Detection logic:** For published phones, flags when `releaseDate` is null or undefined. Distinct from `PHONE_INVALID_RELEASE_DATE` which checks for malformed/future dates on phones that *do* have a date. Confidence `0.8`.

---

### SPECS_RAM_STORAGE_MISMATCH

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `SPECS_RAM_STORAGE_MISMATCH`                               |
| **title**    | RAM/Storage Numeric Mismatch                               |
| **severity** | `medium`                                                   |
| **entityType** | `phone_specs`                                            |
| **canAutoFix** | `false`                                                  |

**Description:** The numeric `ramGB` or `storageGB` does not match the string `ram`/`storage` field.

**Detection logic:** For phones with specs, extracts the first numeric value from the string field (e.g., `"8 GB"` -> `8`) and compares it to the dedicated numeric field. Each mismatch generates a separate issue with the extracted value as `suggestedValue`. Confidence `0.7`.

**Metadata example:** `{ stringField: 'ram', stringValue: '8 GB', numericValue: 12, extractedValue: 8 }`

---

### PHONE_NO_BENCHMARK

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_NO_BENCHMARK`                                       |
| **title**    | Missing Benchmark Data                                     |
| **severity** | `info`                                                     |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Published phone has no benchmark scores recorded.

**Detection logic:** For published phones, checks the benchmarks lookup map. If no `PhoneBenchmark` document is keyed to the phone's ID, an issue is raised. Confidence `0.6` (benchmarks are optional enrichment data).

---

### PHONE_NO_PRICES

| Property     | Value                                                      |
|--------------|------------------------------------------------------------|
| **ruleId**   | `PHONE_NO_PRICES`                                          |
| **title**    | No Retail Price Listings                                   |
| **severity** | `info`                                                     |
| **entityType** | `phone`                                                  |
| **canAutoFix** | `false`                                                  |

**Description:** Phone has no retail price listings from price tracker sources.

**Detection logic:** For published phones, checks the prices lookup map. If no `PhonePrice` records are associated, an issue is raised. This is distinct from `PHONE_MISSING_PRICE` which checks the phone's own `pricePKR` field. Confidence `0.5`.

---

## Summary Table

| #  | Category        | ruleId                       | Severity  | Auto-Fix |
|----|-----------------|------------------------------|-----------|----------|
| 1  | Phone Core      | `PHONE_MISSING_SPECS`        | high      | No       |
| 2  | Phone Core      | `PHONE_DUPLICATE_SLUG`       | critical  | No       |
| 3  | Phone Core      | `PHONE_INVALID_PRICE`        | high      | No       |
| 4  | Phone Core      | `PHONE_MISSING_PRIMARY_IMAGE`| medium    | No       |
| 5  | Phone Core      | `PHONE_MISSING_PRICE`        | high      | No       |
| 6  | Phone Core      | `PHONE_STALE_PRICE`          | low       | No       |
| 7  | Phone Core      | `PHONE_INVALID_RELEASE_DATE` | medium    | No       |
| 8  | Phone Core      | `PHONE_MISSING_PTA_STATUS`   | low       | No       |
| 9  | Specs           | `SPECS_DUPLICATE`            | high      | Yes*     |
| 10 | Specs           | `SPECS_EMPTY`                | medium    | No       |
| 11 | Specs           | `SPECS_MISSING_KEY_FIELDS`   | low       | No       |
| 12 | Specs           | `SPECS_OBJECT_IN_STRING`     | high      | Yes      |
| 13 | Images          | `IMAGE_MULTIPLE_PRIMARY`     | low       | Yes      |
| 14 | Benchmarks      | `BENCHMARK_IMPOSSIBLE_SCORE` | high      | No       |
| 15 | Orphans         | `ORPHAN_SPECS`               | high      | No       |
| 16 | Orphans         | `ORPHAN_IMAGE`               | medium    | No       |
| 17 | Orphans         | `ORPHAN_PRICE`               | medium    | No       |
| 18 | Orphans         | `ORPHAN_BENCHMARK`           | medium    | No       |
| 19 | Brand           | `BRAND_DUPLICATE_NORMALIZED` | high      | No       |
| 20 | Brand           | `BRAND_MISSING_LOGO`         | low       | No       |
| 21 | Price Tracker   | `PRICE_STALE_TRACKED`        | low       | No       |
| 22 | Price Tracker   | `PRICE_SOURCE_INACTIVE`      | info      | No       |
| 23 | Price Tracker   | `PRICE_OUTLIER`              | medium    | No       |
| 24 | Price Tracker   | `PRICE_MISMATCH`             | medium    | No       |
| 25 | Import          | `IMPORT_FAILED_ROWS`         | medium    | No       |
| 26 | Import          | `IMPORT_LOW_CONFIDENCE`      | info      | No       |
| 27 | Additional      | `PHONE_EMPTY_DESCRIPTION`    | low       | No       |
| 28 | Additional      | `PHONE_MISSING_RELEASE_DATE` | low       | No       |
| 29 | Additional      | `SPECS_RAM_STORAGE_MISMATCH` | medium    | No       |
| 30 | Additional      | `PHONE_NO_BENCHMARK`         | info      | No       |
| 31 | Additional      | `PHONE_NO_PRICES`            | info      | No       |

*\* SPECS_DUPLICATE auto-fix returns `Manual review required`*

---

*Generated from source: `src/lib/data-quality/rules/phone-rules.ts`, `src/lib/data-quality/rules/extended-rules.ts`*