# SpecsDekh Image Intelligence

A low-load, admin-reviewed image quality module.

## Detects
- Phones with no thumbnail or gallery images
- Missing thumbnails when gallery images exist
- Invalid or non-HTTPS image URLs
- Missing alt text
- Duplicate gallery URLs
- Thumbnails missing from the gallery

## Safe actions
- Select first valid gallery image as thumbnail
- Upgrade HTTP image URLs to HTTPS
- Generate descriptive alt text
- Remove invalid/duplicate gallery records
- Add the current thumbnail to the gallery

## Guardrails
- No paid AI calls
- No external image scraping or downloading
- No automatic publishing
- Scan limit defaults to 150 and is capped at 500
- Every mutation requires an authenticated admin click
