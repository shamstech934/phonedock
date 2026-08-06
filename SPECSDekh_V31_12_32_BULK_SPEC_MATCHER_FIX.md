# SpecsDekh v31.12.32 — Bulk Specs Auto-Matcher Fix

## Fixed

- Auto Match All remains a one-click workflow; users do not have to process phones individually.
- Serverless work is split into CPU-safe batches of 25 phones (API hard maximum 50).
- The batch endpoint loads local dataset candidates once per batch instead of querying the dataset once per phone.
- Individual product/model matching now normalizes brand and model names separately.
- Model number and variant tokens (5G, Pro, Plus, Ultra, Lite, etc.) must be compatible.
- Brand/category/price-list pages such as `Tecno Mobiles — Mobile Phones Prices 2026` are rejected.
- Dataset rows without enough actual specification fields cannot be auto-applied.
- Invalid imported catalog-page phone records are skipped and reported separately instead of appearing as ordinary “not found” matches.
- Ambiguous matches still require review; only high-confidence, well-separated matches with useful specs are written.
- Existing progress bar and full-queue workflow are preserved.

## Performance

Before: up to two DeviceSpecDataset queries per phone in a 100-phone request.

After: one bounded DeviceSpecDataset query per 25-phone request, candidates grouped by brand in memory, then deterministic matching.

## Safety

- No AI or external paid service.
- No category page is accepted as a phone specs source.
- No low-confidence or sparse candidate is automatically applied.
- Existing PhoneSpecs and provenance write behavior is preserved for accepted matches.
