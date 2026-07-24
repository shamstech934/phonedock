# PhoneDock v18.0 Data Pipeline Stabilization

## Applied fixes

- Added a dedicated `repair-import-v2` API path so the deployed UI cannot accidentally hit an older repair parser.
- Reviewed repair CSV now resolves phones in this order: MongoDB ObjectId, exact slug, normalized brand + normalized model.
- Standard PhoneDock specs CSV files no longer require a `Phone ID` column.
- Matching loads relevant brands and phones in batches and performs normalized matching in memory.
- Repair writes continue to use MongoDB `bulkWrite` with upsert for `PhoneSpecs`.
- API responses include `engineVersion: repair-import-v2` and `Cache-Control: no-store` for deployment verification.
- Admin copy now explicitly states that both exported repair work packs and PhoneDock specs CSV files are accepted.

## Deployment verification

After deploying, open Data Quality > Missing Specs, choose the import-ready CSV and click Preview. The response should no longer say `Invalid Phone ID`. If a row cannot be matched, the message now includes the attempted slug and brand/model values.

## Database note

The code performs upserts keyed by `PhoneSpecs.phoneId`, whose unique index prevents duplicate specs documents for one phone. Live database connectivity cannot be verified without the deployment's private `MONGODB_URI`.
