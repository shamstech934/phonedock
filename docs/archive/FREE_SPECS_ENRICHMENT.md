# PhoneDock Free Specifications Enrichment

This release adds a non-AI, non-destructive CSV enrichment tool.

## Why this workflow

- It does not write directly to MongoDB.
- It creates a review CSV before anything is imported.
- API responses are cached locally, so repeated runs do not waste requests.
- Low-confidence matches are not auto-applied.
- Failed records remain unchanged.

The default source is the open-source `azharimm/phone-specs-api`, whose data is based on GSMArena. It is an unofficial community service, so use it as an admin import helper rather than a live dependency for public PhoneDock pages.

PhoneDB's full dump/API is a licensed product, not assumed to be free. This tool therefore does not scrape PhoneDB.

## Windows usage

Put `phonedock-missing-specs-all.csv` in the project root, open PowerShell in the project folder, then run:

```powershell
python scripts/enrich_phone_specs.py --input phonedock-missing-specs-all.csv --start 0 --limit 50
```

This produces:

- `phonedock-specs-review.csv` — candidate matches and source details for review.
- `phonedock-specs-enriched.csv` — complete original CSV, unchanged unless auto-apply is enabled.

After checking the review output, auto-fill only confident matches:

```powershell
python scripts/enrich_phone_specs.py --input phonedock-missing-specs-all.csv --start 0 --limit 50 --apply-confident
```

Process the next batch:

```powershell
python scripts/enrich_phone_specs.py --input phonedock-specs-enriched.csv --start 50 --limit 50 --apply-confident
```

## Safety controls

- Default batch size: 50
- Default confidence threshold: 0.74
- At least 3 of 7 main fields must be returned before auto-apply
- Source URL, score, and verification time are saved
- Use `--offline-cache` to rerun without network requests
- Change API endpoint with `--api-base` if the public deployment moves

## Important

Do not blindly import all API results. Regional RAM/storage variants may differ. Review any row marked `manual-review` or `not-found`.
