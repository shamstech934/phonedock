---
Task ID: 1
Agent: main
Task: Implement PhoneDock Data Quality Center

Work Log:
- Added 4 new permissions (data-quality:read/scan/fix/delete) to RBAC system in permissions.ts
- Added permissions to superadmin, admin, editor, reviewer role maps
- Created DataQualityIssue and ScanJob Mongoose models in src/lib/models/DataQuality.ts
- Exported new models from src/lib/models/index.ts
- Created types file: src/lib/data-quality/types.ts (DetectedIssue, RuleDefinition, FixContext, FixResult, HealthCategory, HEALTH_CATEGORIES)
- Created phone-rules.ts with 15 rules: PHONE_MISSING_SPECS, PHONE_DUPLICATE_SLUG, PHONE_INVALID_PRICE, PHONE_MISSING_PRIMARY_IMAGE, PHONE_MISSING_PRICE, PHONE_STALE_PRICE, PHONE_INVALID_RELEASE_DATE, PHONE_MISSING_PTA_STATUS, SPECS_EMPTY, SPECS_MISSING_KEY_FIELDS, SPECS_OBJECT_IN_STRING, PHONE_MISSING_BRAND, PHONE_DUPLICATE_NORMALIZED, BENCHMARK_IMPOSSIBLE_SCORE, IMAGE_MULTIPLE_PRIMARY, plus orphan/brand rules
- Created extended-rules.ts with 8 rules: BRAND_DUPLICATE_NORMALIZED, BRAND_MISSING_LOGO, PRICE_STALE_TRACKED, PRICE_SOURCE_INACTIVE, PRICE_OUTLIER, PRICE_MISMATCH, IMPORT_FAILED_ROWS, IMPORT_LOW_CONFIDENCE
- Created rules/index.ts barrel export with 23 total rules
- Created scanner.ts with: startScan, executeScan (full/incremental/entity/import), buildDetectionContext, scanAllPhones (batch processing), scanImportPhones, scanOrphans (specs/images/prices/benchmarks/brands), persistIssues (upsert with dedup), executeAutoFix (with dry run, audit log), calculateHealthScore (7 categories, 100-point weighted)
- Created data-quality/index.ts barrel export
- Created API handler: src/app/api/[[...path]]/handlers/data-quality.ts
  - GET: summary, scans, scans/:id, issues, issues/:id, duplicates, export.csv
  - POST: scans, issues/:id/resolve, issues/:id/ignore, issues/:id/fix, bulk-fix, re-scan, duplicates/:id/merge
- Wired data-quality GET/POST handlers into catch-all route.ts
- Added 'Data Quality' sidebar item with ShieldCheck icon to admin layout.tsx
- Added data-quality permissions to inline rolePerms in admin layout
- Created admin UI page: src/app/admin/data-quality/page.tsx
  - Overview tab: Health score ring, stat cards, severity breakdown, data queues, trends
  - Issues tab (reusable for all queues): search, severity/status filters, bulk select, bulk resolve/ignore, CSV export, re-scan, pagination, detail drawer
  - Queue tabs: Missing Specs, Missing Images, Missing Prices, Orphans, Stale Prices, Import Warnings
  - Duplicates tab: grouped duplicate review, merge modal with dry-run preview
  - Scan History tab: paginated scan job list with status
- Created 5 deliverable markdown files in /download/

Stage Summary:
- 23 quality rules across 7 domains (phone, specs, images, benchmarks, brands, prices, imports)
- 4 scan types: full, incremental, entity-specific, import-specific
- Batch processing with resume capability
- 100-point weighted health score across 7 categories
- Safe auto-fix with dry-run, preview, audit logging
- Duplicate review with merge flow
- 14 API endpoints all requiring admin auth
- 4 new RBAC permissions
- All new code passes lint with zero errors
- No TypeScript errors in new files
- 5 documentation deliverables created