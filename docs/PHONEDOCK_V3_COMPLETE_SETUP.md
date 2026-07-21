# PhoneDock v3.0 Complete Setup

This package combines the existing PhoneDock application, admin tools, monetization integrations, analytics hooks, comparison and recommendation features, price intelligence, review/content modules, and the bulk import system.

## Large phone dataset workflow

PhoneDock does not include an unlicensed proprietary 8,000-phone database. Use data you own or are permitted to reuse.

1. Put a CSV or JSON file in `data-import/`.
2. Prepare and validate it:

```bash
npm run data:prepare -- --input=data-import/phones.csv --chunk-size=500
```

3. Review `data-import/output/import-report.json`, `invalid-rows.json`, and `duplicate-rows.json`.
4. Import the generated chunk files from Admin > Import V2.
5. Start with one chunk, verify the preview, then process the remaining chunks.

The preparation command normalizes brand/model names, generates missing slugs, removes exact duplicates, reports invalid rows, and splits large datasets into manageable batches.

## External IDs required after deployment

Add your own AdSense publisher ID, GA4 Measurement ID, Microsoft Clarity project ID, Search Console verification token, database connection, email provider, and optional affiliate identifiers in Vercel Environment Variables. The Admin Launch Center shows which integrations are configured.
