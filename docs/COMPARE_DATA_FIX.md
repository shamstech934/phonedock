# Compare Data Fix

## Fixed
- Compare lookup now loads specifications from all supported sources: canonical PhoneSpecs, legacy Phone fields, and approved/imported collector records.
- Benchmark records are included in compare responses.
- When stored category scores are missing, conservative compare-only scores are estimated from available specifications and clearly labelled as estimated.
- Compare limit is consistently four phones in the URL loader, picker, and UI.

## Deployment
No dependency, environment variable, or database migration is required.
