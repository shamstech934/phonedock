# Smart Filter Results Fix

## Fixed
- RAM and storage filters now match both normalized numeric fields and legacy imported text such as `4/6/8 GB`.
- Camera, battery, and screen filters now fall back to imported text when numeric helper fields have not been backfilled.
- Screen range query parameters now work during server rendering and client refresh.
- Homepage price links now use the same `priceMin` / `priceMax` parameter names as the phones listing.
- Existing normalized indexes remain preferred, so new/imported normalized data stays fast.

## Why results were empty
Older imported PhoneSpecs rows had values in text fields (`ram`, `storage`, `display`, etc.) but their newer numeric helper fields (`ramGB`, `storageGB`, etc.) were empty. The listing API previously queried only numeric fields.
